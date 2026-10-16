const { getRedisClient } = require('../utils/cache')

/*
 * Lotes do agrupamento no Redis:
 *   batch:open:{user}:{remetente}:{chat} → id do lote aberto; expira no fim da janela (texto depois abre lote novo)
 *   batch:{id}        → JSON do lote; expira em sendAt + TTL + folga (Redis libera o espaço sozinho)
 *   batch:{id}:parts  → textos em ordem; mesma expiração
 *   batch:due         → zset id → próxima tentativa (ms)
 * ponytail: chaves montadas dentro do Lua só funcionam em Redis de nó único; em cluster, usar hash tag {id}.
 */
const DUE_KEY = 'batch:due'
const SEQ_KEY = 'batch:seq'
// Folga para a rodada (10s) ainda ler o lote vencido e logar o que foi descartado
const EXPIRY_GRACE_MS = 60 * 1000
// Reserva: lote pego sai da fila por este tempo; processo que morre no meio devolve o lote sozinho
const CLAIM_LEASE_MS = 2 * 60 * 1000

const metaKey = (id) => `batch:${id}`
const partsKey = (id) => `batch:${id}:parts`
const openKey = ({ userId, senderKey, chatId }) => `batch:open:${userId}:${senderKey}:${chatId}`

const ENQUEUE_SCRIPT = `
local id = redis.call('GET', KEYS[1])
if not id then
  id = tostring(redis.call('INCR', KEYS[3]))
  redis.call('SET', KEYS[1], id, 'PX', ARGV[3])
  redis.call('SET', 'batch:' .. id, ARGV[1], 'PXAT', ARGV[5])
  redis.call('ZADD', KEYS[2], ARGV[4], id)
end
local parts = 'batch:' .. id .. ':parts'
local size = redis.call('RPUSH', parts, ARGV[2])
local ttl = redis.call('PTTL', 'batch:' .. id)
if ttl > 0 then redis.call('PEXPIRE', parts, ttl) end
return { id, size, redis.call('ZSCORE', KEYS[2], id) }
`

const CLAIM_SCRIPT = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[3])
for _, id in ipairs(ids) do redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[2]), id) end
return ids
`

/**
 * Junta o texto ao lote aberto do mesmo usuário + chat + remetente, ou abre um com a janela a partir de agora.
 * A janela não estica. null = Redis fora do ar (quem chama envia na hora).
 * @returns {Promise<{ flushAt: Date, size: number } | null>}
 */
const enqueueBatchPart = async ({ userId, chatId, senderKey, sessionIds, isBalanced, allowedSessionIds, text, credentialId, windowMinutes, ttlSeconds, now = Date.now() }) => {
  const redis = getRedisClient()
  if (!redis) return null
  const windowMs = windowMinutes * 60 * 1000
  const flushAt = now + windowMs
  const expiresAt = flushAt + ttlSeconds * 1000
  const meta = JSON.stringify({ userId, chatId, senderKey, sessionIds, isBalanced, allowedSessionIds: allowedSessionIds ?? null, credentialId: credentialId || null, flushAt, expiresAt, attempts: 0, createdAt: now })
  const [, size, score] = await redis.eval(
    ENQUEUE_SCRIPT, 3, openKey({ userId, senderKey, chatId }), DUE_KEY, SEQ_KEY,
    meta, text, windowMs, flushAt, expiresAt + EXPIRY_GRACE_MS
  )
  return { flushAt: new Date(Number(score)), size: Number(size) }
}

/**
 * Reserva os lotes vencidos (atômico: duas rodadas ou réplicas não pegam o mesmo lote).
 * Lote cujo JSON já sumiu no Redis volta como { id, missing: true }.
 */
const claimDueBatches = async (limit, now = Date.now()) => {
  const redis = getRedisClient()
  if (!redis) return []
  const ids = await redis.eval(CLAIM_SCRIPT, 1, DUE_KEY, now, CLAIM_LEASE_MS, limit)
  if (ids.length === 0) return []
  const pipeline = redis.pipeline()
  ids.forEach((id) => pipeline.get(metaKey(id)).lrange(partsKey(id), 0, -1))
  const replies = await pipeline.exec()
  return ids.map((id, index) => {
    const [[, meta], [, parts]] = replies.slice(index * 2, index * 2 + 2)
    return meta ? { id, ...JSON.parse(meta), parts } : { id, missing: true }
  })
}

const deleteBatch = async (id) => {
  const redis = getRedisClient()
  if (!redis) return
  await redis.multi().del(metaKey(id), partsKey(id)).zrem(DUE_KEY, id).exec()
}

// Nova tentativa daqui a delayMs; a expiração do lote não muda (KEEPTTL; XX não recria lote que já expirou)
const releaseBatchForRetry = async (batch, delayMs, now = Date.now()) => {
  const redis = getRedisClient()
  if (!redis) return
  const { id, parts: _parts, ...meta } = batch
  await redis.multi()
    .set(metaKey(id), JSON.stringify({ ...meta, attempts: meta.attempts + 1 }), 'KEEPTTL', 'XX')
    .zadd(DUE_KEY, now + delayMs, id)
    .exec()
}

module.exports = { enqueueBatchPart, claimDueBatches, deleteBatch, releaseBatchForRetry }
