const { serializeMessageId, serializeWid } = require('./messageMapper')
const { partsForRecipient } = require('./messageParts')
const { acquireSession, releaseSession, sessionReady } = require('./broadcastLane')

const MS_PER_SECOND = 1000
const PART_PAUSE = { minSeconds: 1.5, maxSeconds: 4 }
const CANCELED_REASON = 'Cancelado pelo usuário'
const NO_WHATSAPP_ERROR = 'Número sem WhatsApp'
const PAUSE_REQUEST = 'pause'
const MAX_CONSECUTIVE_FAILURES = 3

const PAUSE_REASONS = {
  requested: 'Pausado pelo usuário',
  instanceDown: 'Pausado: nenhuma instância selecionada está conectada. Retome quando algum número voltar.',
  failureStreak: `Pausado: ${MAX_CONSECUTIVE_FAILURES} falhas seguidas (possível bloqueio ou limitação do número). Retome mais tarde.`
}

const describeError = (error) => (typeof error === 'string' ? error : error?.message || 'erro desconhecido').slice(0, 255)

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

const stopByUser = (signal) => (signal.reason === PAUSE_REQUEST ? ['paused', PAUSE_REASONS.requested] : ['canceled', CANCELED_REASON])

const pickSender = (sessionIds, cursor, excluded, getClient, isReady = () => true) => {
  const count = sessionIds.length
  if (count === 0) return null
  const choose = (requireReady) => {
    for (let attempt = 0; attempt < count; attempt += 1) {
      const index = (cursor + attempt) % count
      const sessionId = sessionIds[index]
      if (excluded.has(sessionId)) continue
      if (requireReady && !isReady(sessionId)) continue
      const client = getClient(sessionId)
      if (client) return { sessionId, client, nextCursor: (index + 1) % count }
    }
    return null
  }
  // Prefere instância livre. Se todas estão na vez de outra lista, espera na próxima do rodízio.
  return choose(true) ?? choose(false)
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
 *
 * @param {object} deps
 * @param {(sessionId: string) => object|null} deps.getClient   client conectado (null se caiu / QR)
 */
const runBroadcast = async (run, {
  getClient, recordResult, finish, publish,
  pause = waitOrAbort, partPause = waitOrAbort, random = Math.random,
  acquireTurn = acquireSession, releaseTurn = releaseSession, isSessionReady = sessionReady
}) => {
  const recipients = run.pacing.randomOrder ? shuffle(run.recipients, random) : run.recipients
  let stop = null
  let cursor = 0
  const excluded = new Set()
  const streaks = new Map()

  for (const [index, recipient] of recipients.entries()) {
    if (run.signal?.aborted) {
      stop = stopByUser(run.signal)
      break
    }
    const sessionIds = Array.isArray(run.sessionIds) ? run.sessionIds : []
    const sender = pickSender(sessionIds, cursor, excluded, getClient, isSessionReady)
    if (!sender) {
      stop = ['paused', pauseWhenNobodyCanSend(sessionIds, excluded)]
      break
    }
    cursor = sender.nextCursor
    const granted = await acquireTurn(sender.sessionId, run.id, run.signal)
    if (!granted) {
      stop = stopByUser(run.signal)
      break
    }
    const delayMs = pickDelayMs(run.pacing, random)
    let outcome
    try {
      outcome = await sendToRecipient(sender.client, recipient, run, () => partPause(pickDelayMs(PART_PAUSE, random)))
    } finally {
      releaseTurn(sender.sessionId, delayMs)
    }
    publish(await recordResult(run.id, recipient.position, outcome))
    const streak = nextFailureStreak(streaks.get(sender.sessionId) ?? 0, outcome)
    streaks.set(sender.sessionId, streak)
    if (streak >= MAX_CONSECUTIVE_FAILURES) {
      excluded.add(sender.sessionId)
      console.warn(`[panel] instância fora do rodízio run=${run.id} sessão=${sender.sessionId}: ${MAX_CONSECUTIVE_FAILURES} falhas seguidas`)
      const moreRecipients = index < recipients.length - 1
      if (moreRecipients && !pickSender(run.sessionIds, cursor, excluded, getClient)) {
        stop = ['paused', PAUSE_REASONS.failureStreak]
        break
      }
    }
    if (index < recipients.length - 1) await pause(delayMs, run.signal)
  }
  if (!stop && run.signal?.aborted) stop = stopByUser(run.signal)

  publish(await finish(run.id, ...(stop ?? ['done', null])))
}

const sendPart = (client, chatId, part) =>
  part.kind === 'text' ? client.sendMessage(chatId, part.text) : client.sendMessage(chatId, part.media, part.options)

const sendToRecipient = async (client, recipient, { parts, trackedPart = 0 }, pauseBetweenParts) => {
  let chatId
  try {
    chatId = serializeWid(await client.getNumberId(recipient.phone))
  } catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
  if (!chatId) return { status: 'failed', error: NO_WHATSAPP_ERROR }

  const recipientParts = partsForRecipient(parts, recipient.position)
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
  runBroadcast, sendToRecipient, pickSender, shuffle, pickDelayMs, waitOrAbort,
  CANCELED_REASON, PAUSE_REQUEST, MAX_CONSECUTIVE_FAILURES
}
