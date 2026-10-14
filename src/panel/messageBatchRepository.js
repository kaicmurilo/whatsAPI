const { query } = require('../database')

const BATCH_COLUMNS = `id, user_id AS "userId", chat_id AS "chatId", session_ids AS "sessionIds", is_balanced AS "isBalanced",
  parts, credential_id AS "credentialId", flush_at AS "flushAt", attempts`

/**
 * Junta o texto ao lote aberto do mesmo usuário + chat + remetente, ou abre um com a janela a partir de agora.
 * A janela não estica: textos que chegam depois só entram no lote que já vai sair.
 * @returns {Promise<{ flushAt: Date, size: number }>}
 */
const enqueueBatchPart = async ({ userId, chatId, senderKey, sessionIds, isBalanced, text, credentialId, windowMinutes }) => {
  const result = await query(
    `INSERT INTO api_message_batches (user_id, chat_id, sender_key, session_ids, is_balanced, parts, credential_id, flush_at)
     VALUES ($1, $2, $3, $4, $5, ARRAY[$6::text], $7, CURRENT_TIMESTAMP + make_interval(mins => $8::int))
     ON CONFLICT (user_id, chat_id, sender_key) WHERE claimed_at IS NULL
     DO UPDATE SET parts = api_message_batches.parts || EXCLUDED.parts
     RETURNING flush_at AS "flushAt", cardinality(parts) AS size`,
    [userId, chatId, senderKey, sessionIds, isBalanced, text, credentialId || null, windowMinutes]
  )
  return result.rows[0]
}

// Reserva os lotes vencidos (SKIP LOCKED: duas rodadas ao mesmo tempo não pegam o mesmo lote)
const claimDueBatches = async (limit) => {
  const result = await query(
    `UPDATE api_message_batches SET claimed_at = CURRENT_TIMESTAMP
     WHERE id IN (
       SELECT id FROM api_message_batches
       WHERE claimed_at IS NULL AND flush_at <= CURRENT_TIMESTAMP
       ORDER BY flush_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING ${BATCH_COLUMNS}`,
    [limit]
  )
  return result.rows
}

const deleteBatch = (id) => query('DELETE FROM api_message_batches WHERE id = $1', [id])

// Falhou: volta para a fila daqui a delaySeconds. Se já existe outro lote aberto para o mesmo chat, junta nele.
const releaseBatchForRetry = async (id, delaySeconds) => {
  await query(
    `WITH failed AS (DELETE FROM api_message_batches WHERE id = $1 RETURNING *)
     INSERT INTO api_message_batches (user_id, chat_id, sender_key, session_ids, is_balanced, parts, credential_id, flush_at, attempts, created_at)
     SELECT user_id, chat_id, sender_key, session_ids, is_balanced, parts, credential_id,
            CURRENT_TIMESTAMP + make_interval(secs => $2::int), attempts + 1, created_at
     FROM failed
     ON CONFLICT (user_id, chat_id, sender_key) WHERE claimed_at IS NULL
     DO UPDATE SET parts = EXCLUDED.parts || api_message_batches.parts,
                   attempts = GREATEST(api_message_batches.attempts, EXCLUDED.attempts)`,
    [id, delaySeconds]
  )
}

// Lote preso em envio (API caiu no meio): volta para a fila no boot
const releaseStaleClaims = async () => {
  const result = await query('UPDATE api_message_batches SET claimed_at = NULL WHERE claimed_at IS NOT NULL')
  return result.rowCount
}

module.exports = { enqueueBatchPart, claimDueBatches, deleteBatch, releaseBatchForRetry, releaseStaleClaims }
