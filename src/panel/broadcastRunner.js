const { serializeMessageId, serializeWid } = require('./messageMapper')
const { partsForRecipient } = require('./messageParts')
const { acquireSession, releaseSession, acquireSendSlot, releaseSendSlot } = require('./broadcastLane')
const { CAP_PAUSE_ERROR } = require('./sendPolicy')

const MS_PER_SECOND = 1000
const PART_PAUSE = { minSeconds: 1.5, maxSeconds: 4 }
const CANCELED_REASON = 'Cancelado pelo usuário'
const NO_WHATSAPP_ERROR = 'Número sem WhatsApp'
const PAUSE_REQUEST = 'pause'
const MAX_CONSECUTIVE_FAILURES = 3

const PAUSE_REASONS = {
  requested: 'Pausado pelo usuário',
  instanceDown: 'Pausado: nenhuma instância selecionada está conectada. Retome quando algum número voltar.',
  failureStreak: `Pausado: ${MAX_CONSECUTIVE_FAILURES} falhas seguidas (possível bloqueio ou limitação do número). Retome mais tarde.`,
  dailyCap: CAP_PAUSE_ERROR
}

const describeError = (error) => (typeof error === 'string' ? error : error?.message || 'erro desconhecido').slice(0, 255)

const isDbTimeout = (error) => {
  const message = typeof error?.message === 'string' ? error.message : ''
  return message.includes('timeout') || message.includes('Connection terminated')
}

const shuffle = (items, random = Math.random) => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

const pickDelayMs = ({ minSeconds, maxSeconds }, random = Math.random) => {
  const minMs = Math.round(minSeconds * MS_PER_SECOND)
  const maxMs = Math.round(maxSeconds * MS_PER_SECOND)
  return minMs + Math.floor(random() * (maxMs - minMs + 1))
}

const waitOrAbort = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve()
  const onAbort = () => {
    clearTimeout(timer)
    resolve()
  }
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, ms)
  signal?.addEventListener('abort', onAbort, { once: true })
})

const stopByUser = (signal) => (
  signal.reason === PAUSE_REQUEST
    ? ['paused', PAUSE_REASONS.requested, 'user']
    : ['canceled', CANCELED_REASON, null]
)

const holdStop = (sessionIds, failureExcluded, capExcluded, getClient) => {
  const connected = sessionIds.filter((sessionId) => getClient(sessionId) && !failureExcluded.has(sessionId))
  const capped = connected.filter((sessionId) => capExcluded.has(sessionId))
  if (connected.length > 0 && capped.length === connected.length) {
    return ['paused', PAUSE_REASONS.dailyCap, 'cap']
  }
  const reason = pauseWhenNobodyCanSend(sessionIds, failureExcluded)
  const code = reason === PAUSE_REASONS.failureStreak ? 'failure' : 'instance'
  return ['paused', reason, code]
}

const lastSentMillis = (value) => {
  if (value === null || value === undefined) return Number.NEGATIVE_INFINITY
  const millis = new Date(value).getTime()
  return Number.isNaN(millis) ? Number.NEGATIVE_INFINITY : millis
}

// Menor quantidade de envios no dia. Empate: quem enviou há mais tempo (nunca enviou vem primeiro).
const pickByDailyLoad = (sessionIds, excluded, getClient, load = new Map()) => {
  const eligible = []
  for (const sessionId of sessionIds) {
    if (excluded.has(sessionId)) continue
    const client = getClient(sessionId)
    if (!client) continue
    const stats = load.get(sessionId)
    eligible.push({
      sessionId,
      client,
      today: stats?.today ?? 0,
      lastSentAt: stats?.lastSentAt ?? null
    })
  }
  if (eligible.length === 0) return null
  eligible.sort((left, right) => {
    if (left.today !== right.today) return left.today - right.today
    return lastSentMillis(left.lastSentAt) - lastSentMillis(right.lastSentAt)
  })
  return { sessionId: eligible[0].sessionId, client: eligible[0].client }
}

const pauseWhenNobodyCanSend = (sessionIds, excluded) => (
  sessionIds.length > 0 && sessionIds.every((sessionId) => excluded.has(sessionId))
    ? PAUSE_REASONS.failureStreak
    : PAUSE_REASONS.instanceDown
)

const nextFailureStreak = (streak, outcome) => {
  if (outcome.status === 'sent') return 0
  return outcome.error === NO_WHATSAPP_ERROR ? streak : streak + 1
}

/**
 * Envia um disparo destinatário por destinatário. Nunca lança: falhas ficam registradas por contato.
 * Parar (cancelar/pausar) só acontece entre contatos — um envio em andamento no WhatsApp termina normalmente.
 * Pausa sozinho ao sinal de bloqueio (instância caiu ou falhas seguidas): quem não recebeu fica pendente.
 * A fila global segura o próximo envio (outra instância ou outra lista) até o intervalo sorteado acabar.
 *
 * @param {object} deps
 * @param {(sessionId: string) => object|null} deps.getClient   client conectado (null se caiu / QR)
 */
const runBroadcast = async (run, {
  getClient, recordResult, finish, publish,
  partPause = waitOrAbort, random = Math.random,
  acquireTurn = acquireSession, releaseTurn = releaseSession,
  acquireSlot = acquireSendSlot, releaseSlot = releaseSendSlot,
  gate = null
}) => {
  const recipients = run.pacing.randomOrder ? shuffle(run.recipients, random) : run.recipients
  let stop = null
  const excluded = new Set()
  const streaks = new Map()
  if (gate) await gate.ready()

  const record = async (position, outcome, senderSessionId = null) => {
    publish(await recordResult(run.id, position, {
      ...outcome,
      senderSessionId: outcome.status === 'sent' ? senderSessionId : null
    }))
  }

  for (const [index, recipient] of recipients.entries()) {
    if (run.signal?.aborted) {
      stop = stopByUser(run.signal)
      break
    }
    if (gate) {
      const windowPause = await gate.pauseForWindow(new Date())
      if (windowPause) {
        stop = ['paused', windowPause.error, windowPause.code]
        break
      }
      const early = await gate.classify(recipient)
      if (early) {
        await record(recipient.position, early)
        continue
      }
    }

    const sessionIds = Array.isArray(run.sessionIds) ? run.sessionIds : []
    let outcome = null
    let sender = null
    let attempts = 0
    const attemptLimit = Math.max(sessionIds.length, 1) + 1
    while (!outcome && !stop && attempts < attemptLimit) {
      attempts += 1
      const slot = await acquireSlot(run.id, run.signal)
      if (!slot) {
        stop = stopByUser(run.signal)
        break
      }
      let delayAfter = 0
      let turnSessionId = null
      let capExcluded = new Set()
      try {
        capExcluded = gate ? await gate.sessionsOverCap(sessionIds) : new Set()
        const blocked = new Set([...excluded, ...capExcluded])
        const load = gate ? await gate.sendLoad(sessionIds) : new Map()
        sender = pickByDailyLoad(sessionIds, blocked, getClient, load)
        if (!sender) {
          stop = holdStop(sessionIds, excluded, capExcluded, getClient)
          break
        }
        const granted = await acquireTurn(sender.sessionId, run.id, run.signal)
        if (!granted) {
          stop = stopByUser(run.signal)
          break
        }
        turnSessionId = sender.sessionId
        delayAfter = pickDelayMs(run.pacing, random)
        let sessionCapped = false
        if (gate) {
          const lateWindow = await gate.pauseForWindow(new Date())
          if (lateWindow) {
            stop = ['paused', lateWindow.error, lateWindow.code]
            delayAfter = 0
          } else if ((await gate.sessionsOverCap([sender.sessionId])).has(sender.sessionId)) {
            delayAfter = 0
            sessionCapped = true
          } else {
            const late = await gate.classify(recipient)
            if (late) {
              outcome = late
              delayAfter = 0
            }
          }
        }
        if (!stop && !outcome && !sessionCapped) {
          outcome = await sendToRecipient(
            sender.client, recipient,
            { parts: run.parts, trackedPart: run.trackedPart ?? 0, personalize: gate ? gate.personalize : null },
            () => partPause(pickDelayMs(PART_PAUSE, random))
          )
        }
        if (outcome) await record(recipient.position, outcome, sender.sessionId)
      } catch (error) {
        delayAfter = 0
        const canRetry = isDbTimeout(error) && attempts < attemptLimit
        console.warn(`[panel] banco indisponível run=${run.id} tentativa=${attempts}: ${describeError(error)}`)
        if (!canRetry) throw error
      } finally {
        if (turnSessionId) releaseTurn(turnSessionId, delayAfter)
        releaseSlot(delayAfter)
      }
    }
    if (stop) break
    if (!outcome) {
      stop = ['paused', PAUSE_REASONS.dailyCap, 'cap']
      break
    }
    if (outcome.status !== 'sent' && outcome.status !== 'failed') continue
    const streak = nextFailureStreak(streaks.get(sender.sessionId) ?? 0, outcome)
    streaks.set(sender.sessionId, streak)
    if (streak >= MAX_CONSECUTIVE_FAILURES) {
      excluded.add(sender.sessionId)
      console.warn(`[panel] instância fora do rodízio run=${run.id} sessão=${sender.sessionId}: ${MAX_CONSECUTIVE_FAILURES} falhas seguidas`)
      const moreRecipients = index < recipients.length - 1
      if (moreRecipients && !pickByDailyLoad(run.sessionIds, excluded, getClient)) {
        stop = ['paused', PAUSE_REASONS.failureStreak, 'failure']
        break
      }
    }
  }
  if (!stop && run.signal?.aborted) stop = stopByUser(run.signal)

  const [status, error, pauseCode] = stop ?? ['done', null, null]
  publish(await finish(run.id, status, error, pauseCode))
}

const sendPart = (client, chatId, part) =>
  part.kind === 'text' ? client.sendMessage(chatId, part.text) : client.sendMessage(chatId, part.media, part.options)

const sendToRecipient = async (client, recipient, { parts, trackedPart = 0, personalize = null }, pauseBetweenParts) => {
  let chatId
  try {
    chatId = serializeWid(await client.getNumberId(recipient.phone))
  } catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
  if (!chatId) return { status: 'failed', error: NO_WHATSAPP_ERROR }

  let recipientParts = partsForRecipient(parts, recipient.position)
  if (typeof personalize === 'function') recipientParts = await personalize(recipientParts, recipient)
  if (recipientParts.length === 0) return { status: 'failed', error: 'Texto vazio depois de tirar o nome' }
  let messageId = null
  for (const [index, part] of recipientParts.entries()) {
    try {
      if (index > 0) await pauseBetweenParts()
      const sent = await sendPart(client, chatId, part)
      if (index === trackedPart && sent) messageId = serializeMessageId(sent)
    } catch (error) {
      if (index === 0) return { status: 'failed', error: describeError(error) }
      return { status: 'sent', messageId, error: describeError(`Parcial: parte ${index + 1} de ${recipientParts.length} falhou: ${error.message}`) }
    }
  }
  return { status: 'sent', messageId }
}

module.exports = {
  runBroadcast, sendToRecipient, pickByDailyLoad, shuffle, pickDelayMs, waitOrAbort,
  CANCELED_REASON, PAUSE_REQUEST, MAX_CONSECUTIVE_FAILURES
}
