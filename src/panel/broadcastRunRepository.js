const { query, withTransaction } = require('../database')
const { messageKeyFromId } = require('./messageMapper')

const RUN_COLUMNS = `id, session_id AS "sessionId", list_id AS "listId", list_name AS "listName", text,
  file_id AS "fileId", file_name AS "fileName", status, total, sent, failed, error,
  delay_min_seconds AS "delayMinSeconds", delay_max_seconds AS "delayMaxSeconds", random_order AS "randomOrder",
  template_id AS "templateId", template_name AS "templateName", parts,
  created_at AS "createdAt", finished_at AS "finishedAt"`

const MAX_ERROR_LENGTH = 255
const truncateError = (error) => (error ? String(error).slice(0, MAX_ERROR_LENGTH) : null)

const createRun = (userId, {
  sessionId, listId, listName, text, fileId, fileName, recipients, pacing, templateId = null, templateName = null, parts = null
}) => withTransaction(async (client) => {
  const runResult = await client.query(
    `INSERT INTO broadcast_runs (user_id, session_id, list_id, list_name, text, file_id, file_name, total,
                                 delay_min_seconds, delay_max_seconds, random_order, template_id, template_name, parts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     RETURNING ${RUN_COLUMNS}`,
    [userId, sessionId, listId, listName, text, fileId, fileName, recipients.length,
      pacing.minSeconds, pacing.maxSeconds, pacing.randomOrder, templateId, templateName, parts ? JSON.stringify(parts) : null]
  )
  const run = runResult.rows[0]
  await client.query(
    `INSERT INTO broadcast_run_recipients (run_id, position, name, phone)
     SELECT $1, ordinality - 1, name, phone
     FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS r(name, phone, ordinality)`,
    [run.id, recipients.map((recipient) => recipient.name), recipients.map((recipient) => recipient.phone)]
  )
  return run
})

/**
 * Marca o destinatário e atualiza o contador do disparo na mesma instrução; devolve o progresso.
 * `isSent` vai como parâmetro próprio: reusar o $ do status em comparação fazia o Postgres
 * deduzir tipos diferentes (varchar × text) e abortar o disparo.
 */
const recordRecipientResult = async (runId, position, { status, error = null, messageId = null }) => {
  const isSent = status === 'sent'
  const counter = isSent ? 'sent' : 'failed'
  const result = await query(
    `WITH recipient AS (
       UPDATE broadcast_run_recipients
       SET status = $3, error = $4, sent_at = CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END,
           message_id = $6, message_key = $7
       WHERE run_id = $1 AND position = $2
     )
     UPDATE broadcast_runs SET ${counter} = ${counter} + 1 WHERE id = $1
     RETURNING ${RUN_COLUMNS}`,
    [runId, position, status, truncateError(error), isSent, messageId, messageKeyFromId(messageId)]
  )
  return result.rows[0]
}

const finishRun = async (runId, status, error = null) => {
  const result = await query(
    `UPDATE broadcast_runs SET status = $2, error = $3, finished_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${RUN_COLUMNS}`,
    [runId, status, truncateError(error)]
  )
  return result.rows[0]
}

const listRuns = async (userId, { page, perPage }) => {
  const result = await query(
    `SELECT ${RUN_COLUMNS}, COUNT(*) OVER() AS total_rows
     FROM broadcast_runs WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total_rows) : 0
  const items = result.rows.map(({ total_rows: _totalRows, ...run }) => run)
  return { items, total, page, perPage }
}

const findRun = async (userId, runId) => {
  const runResult = await query(`SELECT ${RUN_COLUMNS} FROM broadcast_runs WHERE user_id = $1 AND id = $2`, [userId, runId])
  const run = runResult.rows[0]
  if (!run) return null
  const recipients = await query(
    `SELECT position, name, phone, status, error, sent_at AS "sentAt"
     FROM broadcast_run_recipients WHERE run_id = $1 ORDER BY position`,
    [runId]
  )
  return { ...run, recipients: recipients.rows }
}

/**
 * Reabre um disparo encerrado para reenviar só a quem ainda não recebeu (status ≠ sent).
 * Condicional em `status <> 'running'`: duas requisições simultâneas não reabrem o mesmo disparo.
 * @returns {{ run, recipients } | null} null se o disparo estiver em andamento
 */
const reopenRunForRetry = (runId) => withTransaction(async (client) => {
  const runResult = await client.query(
    `UPDATE broadcast_runs
     SET status = 'running', failed = 0, error = NULL, finished_at = NULL
     WHERE id = $1 AND status <> 'running'
     RETURNING ${RUN_COLUMNS}`,
    [runId]
  )
  const run = runResult.rows[0]
  if (!run) return null
  const recipients = await client.query(
    `UPDATE broadcast_run_recipients
     SET status = 'pending', error = NULL, sent_at = NULL, message_id = NULL, message_key = NULL, delivered_at = NULL, read_at = NULL, played_at = NULL
     WHERE run_id = $1 AND status <> 'sent'
     RETURNING position, name, phone`,
    [runId]
  )
  return { run, recipients: recipients.rows.sort((a, b) => a.position - b.position) }
})

// Boot: disparos que estavam rodando quando o processo caiu não são retomados (evita mensagem duplicada)
const interruptRunningRuns = async () => {
  const result = await query(
    `UPDATE broadcast_runs
     SET status = 'interrupted', error = 'Servidor reiniciado durante o envio', finished_at = CURRENT_TIMESTAMP
     WHERE status = 'running'`
  )
  return result.rowCount
}

module.exports = { createRun, recordRecipientResult, finishRun, listRuns, findRun, reopenRunForRetry, interruptRunningRuns }
