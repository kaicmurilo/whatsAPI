const { getSettings } = require('./settingsRepository')
const { getConnectedClient } = require('./broadcastChannels')
const { isGroupMember } = require('./groupMembership')
const { pickBalancedSender } = require('./balancedSender')
const { listUserSessionIds } = require('./broadcastSessions')
const { recordApiSend, loadTodayApiSends } = require('./apiSendRepository')
const { isBatchable, joinParts, senderKeyOf } = require('./messageBatchPolicy')
const { enqueueBatchPart, claimDueBatches, deleteBatch, releaseBatchForRetry } = require('./messageBatchRepository')
const { messageBatchTtlSeconds } = require('../config')

const TICK_MS = 10 * 1000
const BATCHES_PER_TICK = 20
// Curto: com failover quase sempre há quem envie; quem não sai até sendAt + TTL expira
const RETRY_DELAY_MS = 20 * 1000

/**
 * Se o agrupamento está ligado e o envio é texto puro, guarda no lote do chat e devolve o horário do disparo.
 * Senão (ou Redis fora do ar) devolve null e quem chamou envia na hora.
 * allowedSessionIds: instâncias liberadas da credencial (null = todas do usuário) — limita o failover.
 * @returns {Promise<{ flushAt: Date, size: number } | null>}
 */
const queueIfBatching = async ({ userId, chatId, sessionIds, isBalanced, allowedSessionIds = null, contentType, content, options, credentialId }) => {
  if (typeof chatId !== 'string' || !isBatchable(contentType, content, options)) return null
  const settings = await getSettings(userId)
  if (!settings.batchEnabled) return null
  const queued = await enqueueBatchPart({
    userId,
    chatId,
    senderKey: senderKeyOf({ isBalanced, sessionIds }),
    sessionIds,
    isBalanced,
    allowedSessionIds,
    text: content,
    credentialId,
    windowMinutes: settings.batchWindowMinutes,
    ttlSeconds: messageBatchTtlSeconds
  })
  if (!queued) console.warn(`[lote] Redis indisponível: enviando na hora chat=${chatId} user=${userId}`)
  return queued
}

// Balanceado: menor carga do dia; grupo só entre quem participa. Contato: qualquer conectada.
const pickAmong = async (sessionIds, batch, deps) => {
  const picked = await pickBalancedSender({
    sessionIds, chatId: batch.chatId, getClient: deps.getClient, isMember: deps.isMember, loadDaily: deps.loadDaily
  })
  return picked.error ? { error: picked.error[1] } : picked.sender
}

const pickChosen = async (batch, deps) => {
  if (batch.isBalanced) return pickAmong(batch.sessionIds, batch, deps)
  const [sessionId] = batch.sessionIds
  const client = deps.getClient(sessionId)
  return client ? { sessionId, client } : { error: `instância ${sessionId} não está conectada` }
}

// Reserva: outras instâncias do usuário (só as liberadas na credencial) que alcançam o chat
const pickFallback = async (batch, deps) => {
  const others = (await deps.listUserSessions(batch.userId)).filter((sessionId) =>
    !batch.sessionIds.includes(sessionId) && (!batch.allowedSessionIds || batch.allowedSessionIds.includes(sessionId)))
  return others.length > 0 ? pickAmong(others, batch, deps) : { error: 'nenhuma outra instância do usuário' }
}

const pickSender = async (batch, deps) => {
  const chosen = await pickChosen(batch, deps)
  if (!chosen.error) return chosen
  const fallback = await pickFallback(batch, deps)
  return fallback.error ? { error: `${chosen.error}; reserva: ${fallback.error}` } : { ...fallback, replaced: chosen.error }
}

const expireBatch = async (batch, why, deps) => {
  await deps.deleteBatch(batch.id)
  console.error(`[lote] expirado sem envio lote=${batch.id} chat=${batch.chatId} textos=${batch.parts.length} user=${batch.userId}: ${why}`)
}

const retryLater = async (batch, reason, deps) => {
  await deps.releaseBatchForRetry(batch, RETRY_DELAY_MS)
  console.warn(`[lote] nova tentativa em ${RETRY_DELAY_MS / 1000}s lote=${batch.id} chat=${batch.chatId} tentativa=${batch.attempts + 1}: ${reason}`)
}

/** Um lote vencido vira uma mensagem só. Falha volta para a fila até o TTL; vencido não envia mais. */
const flushBatch = async (batch, deps, now = Date.now()) => {
  if (now >= batch.expiresAt) return expireBatch(batch, `passou do prazo (${new Date(batch.expiresAt).toISOString()}) após ${batch.attempts} tentativa(s)`, deps)
  const sender = await pickSender(batch, deps)
  if (sender.error) return retryLater(batch, sender.error, deps)
  try {
    const message = await sender.client.sendMessage(batch.chatId, joinParts(batch.parts))
    await deps.deleteBatch(batch.id)
    deps.recordApiSend({ sessionId: sender.sessionId, chatId: batch.chatId, message, credentialId: batch.credentialId, batchSize: batch.parts.length })
    if (sender.replaced) console.warn(`[lote] failover lote=${batch.id} enviado por ${sender.sessionId}: ${sender.replaced}`)
    console.log(`[lote] enviado lote=${batch.id} sessão=${sender.sessionId} chat=${batch.chatId} textos=${batch.parts.length} user=${batch.userId}`)
  } catch (error) {
    await retryLater(batch, error.message, deps)
  }
}

const defaultDeps = {
  getClient: getConnectedClient,
  isMember: isGroupMember,
  listUserSessions: listUserSessionIds,
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
    for (const batch of due) {
      if (batch.missing) {
        await deleteBatch(batch.id)
        console.warn(`[lote] lote=${batch.id} já tinha expirado no Redis (API fora do ar além do TTL): descartado`)
        continue
      }
      await flushBatch(batch, defaultDeps)
    }
  } catch (error) {
    console.error('[lote] falha ao processar lotes vencidos:', error.message)
  } finally {
    isTicking = false
  }
}

// Várias réplicas são seguras: a reserva é atômica no Redis e expira sozinha (lease) se o processo morrer
const startMessageBatcher = () => {
  setInterval(tick, TICK_MS).unref()
  console.log(`[lote] agrupamento de mensagens ativo no Redis (verifica a cada ${TICK_MS / 1000}s, TTL ${messageBatchTtlSeconds}s após o horário de envio)`)
}

// Resposta da API quando o texto entrou no lote: nada foi enviado ainda
const batchedResponse = (queued) => ({ success: true, batched: true, sendAt: queued.flushAt, batchSize: queued.size })

module.exports = { queueIfBatching, batchedResponse, flushBatch, startMessageBatcher, RETRY_DELAY_MS }
