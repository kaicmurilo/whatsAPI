const { serializeMessageId, serializeWid } = require('./messageMapper')

const MS_PER_SECOND = 1000
// Pausa curta entre as partes de um mesmo contato (texto → áudio → vídeo): ritmo de quem está enviando à mão
const PART_PAUSE = { minSeconds: 1.5, maxSeconds: 4 }
const INSTANCE_DOWN_ERROR = 'Instância desconectada durante o envio'
const CANCELED_REASON = 'Cancelado pelo usuário'

const describeError = (error) => (typeof error === 'string' ? error : error?.message || 'erro desconhecido').slice(0, 255)

// Fisher–Yates: cada disparo sai numa ordem diferente, sem padrão repetido para o WhatsApp
const shuffle = (items, random = Math.random) => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

// Intervalo sorteado dentro da faixa do disparo (inclusive nas pontas)
const pickDelayMs = ({ minSeconds, maxSeconds }, random = Math.random) => {
  const minMs = Math.round(minSeconds * MS_PER_SECOND)
  const maxMs = Math.round(maxSeconds * MS_PER_SECOND)
  return minMs + Math.floor(random() * (maxMs - minMs + 1))
}

// Espera que termina na hora se o disparo for abortado (não obriga a aguardar os 45 s restantes)
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

const finalStatus = ({ canceled, instanceDown }) => {
  if (canceled) return ['canceled', CANCELED_REASON]
  if (instanceDown) return ['failed', INSTANCE_DOWN_ERROR]
  return ['done', null]
}

/**
 * Envia um disparo destinatário por destinatário. Nunca lança: falhas ficam registradas por contato.
 * O cancelamento só acontece entre envios — um envio já em andamento no WhatsApp termina normalmente.
 *
 * @param {object} run  { id, recipients: [{ position, name, phone }],
 *                        parts: [{ kind: 'text', text } | { kind: 'media', media, options }], trackedPart: number,
 *                        pacing: { minSeconds, maxSeconds, randomOrder }, signal?: AbortSignal }
 * @param {object} deps
 * @param {() => object|null} deps.getClient   client atual da sessão (null se caiu no meio)
 * @param {Function} deps.recordResult         (runId, position, { status, error, messageId }) → progresso
 * @param {Function} deps.finish               (runId, status, error) → disparo finalizado
 * @param {Function} deps.publish              (progress) → notifica o painel
 * @param {Function} [deps.pause]              (ms, signal) espera entre contatos (injetável em teste)
 * @param {Function} [deps.partPause]          (ms) espera entre as partes de um contato (injetável em teste)
 * @param {Function} [deps.random]             gerador [0,1) (injetável em teste)
 */
const runBroadcast = async (run, { getClient, recordResult, finish, publish, pause = waitOrAbort, partPause = waitOrAbort, random = Math.random }) => {
  const recipients = run.pacing.randomOrder ? shuffle(run.recipients, random) : run.recipients
  const state = { canceled: false, instanceDown: false }

  for (const [index, recipient] of recipients.entries()) {
    if (run.signal?.aborted) {
      state.canceled = true
      break
    }
    const client = getClient()
    if (!client) {
      state.instanceDown = true
      await recordResult(run.id, recipient.position, { status: 'failed', error: INSTANCE_DOWN_ERROR })
      continue
    }
    const outcome = await sendToRecipient(client, recipient, run, () => partPause(pickDelayMs(PART_PAUSE, random)))
    publish(await recordResult(run.id, recipient.position, outcome))
    if (index < recipients.length - 1) await pause(pickDelayMs(run.pacing, random), run.signal)
  }
  if (run.signal?.aborted) state.canceled = true

  publish(await finish(run.id, ...finalStatus(state)))
}

const sendPart = (client, chatId, part) =>
  part.kind === 'text' ? client.sendMessage(chatId, part.text) : client.sendMessage(chatId, part.media, part.options)

/**
 * Envia todas as partes para um contato. O id da parte rastreada liga os tiques (entregue/lido) ao destinatário;
 * às vezes o wwebjs devolve undefined (chats @lid) e o deliveryTracker vincula depois pelo primeiro ack.
 * Se a 1ª parte já saiu e uma seguinte falha, o contato fica "enviado" com erro de parcial: reprocessar
 * não reenvia (duplicaria o que já chegou).
 */
const sendToRecipient = async (client, recipient, { parts, trackedPart = 0 }, pauseBetweenParts) => {
  let chatId
  try {
    chatId = serializeWid(await client.getNumberId(recipient.phone))
  } catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
  if (!chatId) return { status: 'failed', error: 'Número sem WhatsApp' }

  let messageId = null
  for (const [index, part] of parts.entries()) {
    try {
      if (index > 0) await pauseBetweenParts()
      const sent = await sendPart(client, chatId, part)
      if (index === trackedPart && sent) messageId = serializeMessageId(sent)
    } catch (error) {
      if (index === 0) return { status: 'failed', error: describeError(error) }
      return { status: 'sent', messageId, error: describeError(`Parcial: parte ${index + 1} de ${parts.length} falhou: ${error.message}`) }
    }
  }
  return { status: 'sent', messageId }
}

module.exports = { runBroadcast, shuffle, pickDelayMs, waitOrAbort, CANCELED_REASON }
