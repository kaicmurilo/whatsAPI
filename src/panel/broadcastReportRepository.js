const { query } = require('../database')

// Situação do destinatário, da mais avançada para a menos: lido > entregue > enviado
const SITUATION_SQL = `CASE
  WHEN status = 'failed' THEN 'failed'
  WHEN status = 'pending' THEN 'pending'
  WHEN read_at IS NOT NULL THEN 'read'
  WHEN delivered_at IS NOT NULL THEN 'delivered'
  ELSE 'sent' END`

// Filtros cumulativos: "entregues" inclui quem já leu
const SITUATION_FILTERS = {
  all: 'TRUE',
  pending: "status = 'pending'",
  sent: "status = 'sent'",
  delivered: 'delivered_at IS NOT NULL',
  read: 'read_at IS NOT NULL',
  failed: "status = 'failed'"
}

const RECIPIENT_COLUMNS = `position, name, phone, ${SITUATION_SQL} AS situation, error,
  sent_at AS "sentAt", delivered_at AS "deliveredAt", read_at AS "readAt", played_at AS "playedAt"`

const findReportSummary = async (userId, runId) => {
  const result = await query(
    `SELECT r.id, r.session_id AS "sessionId", r.list_name AS "listName", r.text, r.file_name AS "fileName",
            r.status, r.total, r.sent, r.failed, r.error, r.created_at AS "createdAt", r.finished_at AS "finishedAt",
            COUNT(*) FILTER (WHERE rr.delivered_at IS NOT NULL)::int AS delivered,
            COUNT(*) FILTER (WHERE rr.read_at IS NOT NULL)::int AS read,
            COUNT(*) FILTER (WHERE rr.played_at IS NOT NULL)::int AS played
     FROM broadcast_runs r
     LEFT JOIN broadcast_run_recipients rr ON rr.run_id = r.id
     WHERE r.user_id = $1 AND r.id = $2
     GROUP BY r.id`,
    [userId, runId]
  )
  return result.rows[0] || null
}

const listReportRecipients = async (runId, { page, perPage, situation }) => {
  const result = await query(
    `SELECT ${RECIPIENT_COLUMNS}, COUNT(*) OVER() AS total
     FROM broadcast_run_recipients
     WHERE run_id = $1 AND ${SITUATION_FILTERS[situation]}
     ORDER BY position
     LIMIT $2 OFFSET $3`,
    [runId, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...recipient }) => recipient)
  return { items, total, page, perPage }
}

// CSV: todos os destinatários (máx. 256 por lista)
const listAllReportRecipients = async (runId) => {
  const result = await query(`SELECT ${RECIPIENT_COLUMNS} FROM broadcast_run_recipients WHERE run_id = $1 ORDER BY position`, [runId])
  return result.rows
}

const isKnownSituation = (situation) => Object.prototype.hasOwnProperty.call(SITUATION_FILTERS, situation)

module.exports = { findReportSummary, listReportRecipients, listAllReportRecipients, isKnownSituation }
