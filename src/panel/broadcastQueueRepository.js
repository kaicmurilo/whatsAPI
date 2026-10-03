const { query } = require('../database')
const { buildContactSearch } = require('./contactRepository')

// Disparos que ainda vão enviar: rodando, pausados ou interrompidos (programado ainda não tem destinatários)
const OPEN_RUN_STATUSES = ['running', 'paused', 'interrupted']

/**
 * Fila: contatos pendentes de todos os disparos abertos do usuário, na ordem em que sairiam.
 * Busca casa no nome; com dígitos, também no telefone.
 */
const listQueuedRecipients = async (userId, { page, perPage, search }) => {
  const { namePattern, phonePattern } = buildContactSearch(search)
  const result = await query(
    `SELECT r.run_id::text AS "runId", r.position, r.name, r.phone, b.list_name AS "listName", b.channel,
            b.status AS "runStatus", COUNT(*) OVER() AS total
     FROM broadcast_run_recipients r JOIN broadcast_runs b ON b.id = r.run_id
     WHERE b.user_id = $1 AND b.status = ANY($2::text[]) AND r.status = 'pending'
       AND ($3::text IS NULL OR r.name ILIKE $3 OR ($4::text IS NOT NULL AND r.phone LIKE $4))
     ORDER BY b.created_at, r.run_id, r.position
     LIMIT $5 OFFSET $6`,
    [userId, OPEN_RUN_STATUSES, namePattern, phonePattern, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...item }) => item)
  return { items, total, page, perPage }
}

/**
 * Tira da fila (só quem ainda está pendente: enviado não volta atrás).
 * @returns {Promise<boolean>} false se não existe, não é do usuário ou já saiu da fila
 */
const removeQueuedRecipient = async (userId, runId, position, reason) => {
  const result = await query(
    `UPDATE broadcast_run_recipients r SET status = 'removed', error = $4
     FROM broadcast_runs b
     WHERE b.id = r.run_id AND b.user_id = $1 AND r.run_id = $2 AND r.position = $3 AND r.status = 'pending'`,
    [userId, runId, position, reason]
  )
  return result.rowCount > 0
}

const isRecipientRemoved = async (runId, position) => {
  const result = await query(
    "SELECT 1 FROM broadcast_run_recipients WHERE run_id = $1 AND position = $2 AND status = 'removed'",
    [runId, position]
  )
  return result.rows.length > 0
}

module.exports = { listQueuedRecipients, removeQueuedRecipient, isRecipientRemoved }
