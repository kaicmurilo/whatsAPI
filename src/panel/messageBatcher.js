const { getSettings } = require('./settingsRepository')
const { getConnectedClient } = require('./broadcastChannels')
const { isGroupMember } = require('./groupMembership')
const { pickBalancedSender } = require('./balancedSender')
const { recordApiSend, loadTodayApiSends } = require('./apiSendRepository')
const { isBatchable, joinParts, senderKeyOf } = require('./messageBatchPolicy')
const { enqueueBatchPart, claimDueBatches, deleteBatch, releaseBatchForRetry, releaseStaleClaims } = require('./messageBatchRepository')

const TICK_MS = 10 * 1000
const BATCHES_PER_TICK = 20
const RETRY_DELAY_SECONDS = 60
// Erro de envio de verdade (WhatsApp recusou): ~10 min tentando, depois desiste e loga
const MAX_ATTEMPTS = 10
// Sem instância conectada (deploy, queda, QR) não gasta tentativa: espera ela voltar por até 24h
const MAX_WAIT_OFFLINE_MS = 24 * 60 * 60 * 1000

/**
 * Se o agrupamento está ligado e o envio é texto puro, guarda no lote do chat e devolve o horário do disparo.
 * Senão devolve null e quem chamou envia na hora.
 * @returns {Promise<{ flushAt: Date, size: number } | null>}
 */
const queueIfBatching = async ({ userId, chatId, sessionIds, isBalanced, contentType, content, options, credentialId }) => {
  if (typeof chatId !== 'string' || !isBatchable(contentType, content, options)) return null
  const settings = await getSettings(userId)
  if (!settings.batchEnabled) return null
  return enqueueBatchPart({
    userId,
    chatId,
    senderKey: senderKeyOf({ isBalanced, sessionIds }),
    sessionIds,
    isBalanced,
    text: content,
    credentialId,
    windowMinutes: settings.batchWindowMinutes
  })
}

// Balanceado escolhe na hora do disparo (carga do momento; grupo só entre quem participa)
const pickSender = async (batch, deps) => {
  if (batch.isBalanced) {
    const picked = await pickBalancedSender({
      sessionIds: batch.sessionIds, chatId: batch.chatId, getClient: deps.getClient, isMember: deps.isMember, loadDaily: deps.loadDaily
    })
    return picked.error ? { error: picked.error[1] } : picked.sender
  }
  const [sessionId] = batch.sessionIds
  const client = deps.getClient(sessionId)
  return client ? { sessionId, client } : { error: `instância ${sessionId} não está conectada` }
}

const dropBatch = async (batch, why, deps) => {
  await deps.deleteBatch(batch.id)
  console.error(`[lote] descartado lote=${batch.id} chat=${batch.chatId} textos=${batch.parts.length} user=${batch.userId}: ${why}`)
}

const giveUpOrRetry = async (batch, reason, deps) => {
  if (batch.attempts + 1 >= MAX_ATTEMPTS) return dropBatch(batch, `${MAX_ATTEMPTS} tentativas com erro: ${reason}`, deps)
  await deps.releaseBatchForRetry(batch.id, RETRY_DELAY_SECONDS, true)
  console.warn(`[lote] nova tentativa em ${RETRY_DELAY_SECONDS}s lote=${batch.id} chat=${batch.chatId} tentativa=${batch.attempts + 1}: ${reason}`)
}

const waitForSender = async (batch, reason, deps) => {
  const waitedMs = Date.now() - new Date(batch.createdAt).getTime()
  if (waitedMs > MAX_WAIT_OFFLINE_MS) return dropBatch(batch, `24h sem instância para enviar: ${reason}`, deps)
  await deps.releaseBatchForRetry(batch.id, RETRY_DELAY_SECONDS, false)
  // Um aviso por ~10 min de espera, não a cada minuto
  if (Math.round(waitedMs / 60000) % 10 === 0) console.warn(`[lote] aguardando instância conectada lote=${batch.id} chat=${batch.chatId} há ${Math.round(waitedMs / 60000)} min: ${reason}`)
}

/** Um lote vencido vira uma mensagem só. Falha devolve o lote para a fila; nada é descartado em silêncio. */
const flushBatch = async (batch, deps) => {
  const sender = await pickSender(batch, deps)
  if (sender.error) return waitForSender(batch, sender.error, deps)
  try {
    const message = await sender.client.sendMessage(batch.chatId, joinParts(batch.parts))
    await deps.deleteBatch(batch.id)
    deps.recordApiSend({ sessionId: sender.sessionId, chatId: batch.chatId, message, credentialId: batch.credentialId, batchSize: batch.parts.length })
    console.log(`[lote] enviado lote=${batch.id} sessão=${sender.sessionId} chat=${batch.chatId} textos=${batch.parts.length} user=${batch.userId}`)
  } catch (error) {
    await giveUpOrRetry(batch, error.message, deps)
  }
}

const defaultDeps = {
  getClient: getConnectedClient,
  isMember: isGroupMember,
  loadDaily: loadTodayApiSends,
  recordApiSend,
  deleteBatch,
  releaseBatchForRetry
}

let isTicking = false
const tick = async () => {
  if (isTicking) return
  isTicking = true
  try {
    const due = await claimDueBatches(BATCHES_PER_TICK)
    for (const batch of due) await flushBatch(batch, defaultDeps)
  } catch (error) {
    console.error('[lote] falha ao processar lotes vencidos:', error.message)
  } finally {
    isTicking = false
  }
}

/**
 * ponytail: um processo só (mesmo padrão do agendador de disparos); com várias réplicas o SKIP LOCKED
 * já impede envio duplo, mas o releaseStaleClaims do boot de uma réplica soltaria lotes de outra.
 */
const startMessageBatcher = async () => {
  const released = await releaseStaleClaims()
  if (released > 0) console.warn(`[lote] ${released} lote(s) interrompido(s) no meio do envio voltaram para a fila`)
  setInterval(tick, TICK_MS).unref()
  console.log(`[lote] agrupamento de mensagens ativo (verifica a cada ${TICK_MS / 1000}s)`)
}

// Resposta da API quando o texto entrou no lote: nada foi enviado ainda
const batchedResponse = (queued) => ({ success: true, batched: true, sendAt: queued.flushAt, batchSize: queued.size })

module.exports = { queueIfBatching, batchedResponse, flushBatch, startMessageBatcher, MAX_ATTEMPTS, MAX_WAIT_OFFLINE_MS }
