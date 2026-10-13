const { query } = require('../database')
const { buildContactSearch } = require('./contactRepository')

// Situação do destinatário, da mais avançada para a menos: lido > entregue > enviado
const SITUATION_SQL = `CASE
  WHEN status = 'failed' THEN 'failed'
  WHEN status = 'pending' THEN 'pending'
  WHEN status = 'awaiting_reply' THEN 'awaiting_reply'
  WHEN status = 'suppressed' THEN 'suppressed'
  WHEN status = 'duplicate' THEN 'duplicate'
  WHEN status = 'replied' THEN 'replied'
  WHEN status = 'removed' THEN 'removed'
  WHEN read_at IS NOT NULL THEN 'read'
  WHEN delivered_at IS NOT NULL THEN 'delivered'
  ELSE 'sent' END`

const SITUATION_FILTERS = {
  all: 'TRUE',
  pending: "status = 'pending'",
  awaiting_reply: "status = 'awaiting_reply'",
  suppressed: "status = 'suppressed'",
  duplicate: "status = 'duplicate'",
  replied: "status = 'replied'",
  removed: "status = 'removed'",
  sent: "status = 'sent'",
  delivered: 'delivered_at IS NOT NULL',
  read: 'read_at IS NOT NULL',
  failed: "status = 'failed'"
}

const RECIPIENT_COLUMNS = `position, name, phone, ${SITUATION_SQL} AS situation, error,
  sent_at AS "sentAt", delivered_at AS "deliveredAt", read_at AS "readAt", played_at AS "playedAt"`

const findReportSummary = async (userId, runId) => {
  const result = await query(
    `SELECT r.id, r.session_id AS "sessionId", r.channel, r.list_name AS "listName", r.text, r.file_name AS "fileName",
            r.status, r.total, r.sent, r.failed, r.error, r.created_at AS "createdAt", r.finished_at AS "finishedAt",
            COUNT(*) FILTER (WHERE rr.status = 'awaiting_reply')::int AS awaiting,
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

// Mensagem do disparo para o relatório: texto; sem texto, o modelo ou o arquivo
const RUN_MESSAGE_SQL = "COALESCE(NULLIF(b.text, ''), b.template_name, b.file_name)"

/**
 * Relatório geral (todas as listas): um número por linha com lista, mensagem, quando foi agendado e quando sai/saiu.
 * Quem foi removido da fila não entra. Programado ainda não tem destinatários gravados: usa os membros atuais da lista, que é quem vai receber no horário.
 * Busca casa no nome do contato e da lista; com dígitos, também no telefone.
 * perPage null traz todas as linhas (CSV).
 */
const listSendReport = async (userId, { page, perPage, search }) => {
  const { namePattern, phonePattern } = buildContactSearch(search)
  const result = await query(
    `WITH report_rows AS (
       SELECT b.id AS run_id, rr.position, rr.name, rr.phone, b.list_name, b.channel, ${RUN_MESSAGE_SQL} AS message,
              rr.status, b.created_at, b.scheduled_at, rr.sent_at
       FROM broadcast_runs b JOIN broadcast_run_recipients rr ON rr.run_id = b.id
       WHERE b.user_id = $1 AND b.status NOT IN ('scheduled', 'canceled') AND rr.status <> 'removed'
       UNION ALL
       SELECT b.id, (ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY c.name, c.id) - 1)::int, c.name, c.phone, b.list_name, b.channel,
              ${RUN_MESSAGE_SQL}, 'scheduled', b.created_at, b.scheduled_at, NULL
       FROM broadcast_runs b
       JOIN broadcast_list_members m ON m.list_id = b.list_id
       JOIN panel_contacts c ON c.id = m.contact_id
       WHERE b.user_id = $1 AND b.status = 'scheduled'
     )
     SELECT run_id::text AS "runId", position, name, phone, list_name AS "listName", channel, message, status,
            created_at AS "createdAt", scheduled_at AS "scheduledAt", sent_at AS "sentAt", COUNT(*) OVER() AS total
     FROM report_rows
     WHERE ($2::text IS NULL OR name ILIKE $2 OR list_name ILIKE $2 OR ($3::text IS NOT NULL AND phone LIKE $3))
     ORDER BY created_at DESC, run_id DESC, position
     LIMIT $4 OFFSET $5`,
    [userId, namePattern, phonePattern, perPage, (page - 1) * (perPage ?? 0)]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...row }) => row)
  return { items, total, page, perPage }
}

module.exports = { findReportSummary, listReportRecipients, listAllReportRecipients, isKnownSituation, listSendReport }
