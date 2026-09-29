const { query, withTransaction } = require('../database')
const { messageKeyFromId } = require('./messageMapper')

const RUN_COLUMNS = `id, session_id AS "sessionId", session_ids AS "sessionIds", list_id AS "listId", list_name AS "listName", text,
  file_id AS "fileId", file_name AS "fileName", status, total, sent, failed, error,
  delay_min_seconds AS "delayMinSeconds", delay_max_seconds AS "delayMaxSeconds", random_order AS "randomOrder",
  template_id AS "templateId", template_name AS "templateName", parts, scheduled_at AS "scheduledAt", user_id AS "userId",
  created_at AS "createdAt", finished_at AS "finishedAt"`

const MAX_ERROR_LENGTH = 255
const truncateError = (error) => (error ? String(error).slice(0, MAX_ERROR_LENGTH) : null)

const createRun = (userId, {
  sessionId, sessionIds = [sessionId], listId, listName, text, fileId, fileName, recipients, pacing, templateId = null, templateName = null, parts = null
}) => withTransaction(async (client) => {
  const ids = sessionIds.length > 0 ? sessionIds : [sessionId]
  const runResult = await client.query(
    `INSERT INTO broadcast_runs (user_id, session_id, session_ids, list_id, list_name, text, file_id, file_name, total,
                                 delay_min_seconds, delay_max_seconds, random_order, template_id, template_name, parts)
     VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     RETURNING ${RUN_COLUMNS}`,
    [userId, ids[0], ids, listId, listName, text, fileId, fileName, recipients.length,
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
 * awaiting_reply: saudação enviada — não incrementa sent/failed.
 * `isSent` vai como parâmetro próprio: reusar o $ do status em comparação fazia o Postgres
 * deduzir tipos diferentes (varchar × text) e abortar o disparo.
 */
const SKIP_STATUSES = new Set(['suppressed', 'duplicate', 'replied'])

const recordRecipientResult = async (runId, position, {
  status, error = null, messageId = null, greetingSessionId = null, senderSessionId = null
}) => {
  if (SKIP_STATUSES.has(status)) {
    await query(
      `UPDATE broadcast_run_recipients
       SET status = $3, error = $4, sent_at = NULL, message_id = NULL, message_key = NULL, sender_session_id = NULL
       WHERE run_id = $1 AND position = $2`,
      [runId, position, status, truncateError(error)]
    )
    const result = await query(`SELECT ${RUN_COLUMNS} FROM broadcast_runs WHERE id = $1`, [runId])
    return result.rows[0]
  }
  if (status === 'awaiting_reply') {
    await query(
      `UPDATE broadcast_run_recipients
       SET status = 'awaiting_reply', error = NULL, greeting_sent_at = CURRENT_TIMESTAMP,
           greeting_session_id = $3, message_id = $4, message_key = $5, sent_at = NULL
       WHERE run_id = $1 AND position = $2`,
      [runId, position, greetingSessionId, messageId, messageKeyFromId(messageId)]
    )
    const result = await query(`SELECT ${RUN_COLUMNS} FROM broadcast_runs WHERE id = $1`, [runId])
    return result.rows[0]
  }
  const isSent = status === 'sent'
  const counter = isSent ? 'sent' : 'failed'
  const result = await query(
    `WITH recipient AS (
       UPDATE broadcast_run_recipients
       SET status = $3, error = $4, sent_at = CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END,
           message_id = $6, message_key = $7,
           sender_session_id = CASE WHEN $5::boolean THEN $8 ELSE NULL END
       WHERE run_id = $1 AND position = $2
     )
     UPDATE broadcast_runs SET ${counter} = ${counter} + 1 WHERE id = $1
     RETURNING ${RUN_COLUMNS}`,
    [runId, position, status, truncateError(error), isSent, messageId, messageKeyFromId(messageId), senderSessionId]
  )
  return result.rows[0]
}

// done com awaiting_reply legados → awaiting. Novos disparos não criam mais saudação.
const finishRun = async (runId, status, error = null, pauseCode = null) => {
  if (status === 'done') {
    const awaiting = await query(
      `SELECT 1 FROM broadcast_run_recipients WHERE run_id = $1 AND status = 'awaiting_reply' LIMIT 1`,
      [runId]
    )
    if (awaiting.rows.length > 0) {
      const result = await query(
        `UPDATE broadcast_runs SET status = 'awaiting', error = NULL, pause_code = NULL, finished_at = NULL WHERE id = $1 RETURNING ${RUN_COLUMNS}`,
        [runId]
      )
      return result.rows[0]
    }
  }
  const result = await query(
    `UPDATE broadcast_runs
     SET status = $2, error = $3, finished_at = CURRENT_TIMESTAMP, pause_code = $4
     WHERE id = $1 RETURNING ${RUN_COLUMNS}`,
    [runId, status, truncateError(error), status === 'paused' ? pauseCode : null]
  )
  return result.rows[0]
}

// Último follow-up: se não restar awaiting_reply e o run está awaiting, fecha como done
const tryCloseAwaitingRun = async (runId) => {
  const result = await query(
    `UPDATE broadcast_runs
     SET status = 'done', error = NULL, finished_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'awaiting'
       AND NOT EXISTS (
         SELECT 1 FROM broadcast_run_recipients r WHERE r.run_id = $1 AND r.status = 'awaiting_reply'
       )
     RETURNING ${RUN_COLUMNS}`,
    [runId]
  )
  return result.rows[0] || null
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
    `SELECT position, name, phone, status, error, sent_at AS "sentAt",
            greeting_sent_at AS "greetingSentAt", greeting_session_id AS "greetingSessionId"
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
     WHERE id = $1 AND status NOT IN ('running', 'scheduled')
     RETURNING ${RUN_COLUMNS}`,
    [runId]
  )
  const run = runResult.rows[0]
  if (!run) return null
  const recipients = await client.query(
    `UPDATE broadcast_run_recipients
     SET status = 'pending', error = NULL, sent_at = NULL, message_id = NULL, message_key = NULL,
         delivered_at = NULL, read_at = NULL, played_at = NULL,
         greeting_sent_at = NULL, greeting_session_id = NULL
     WHERE run_id = $1 AND status IN ('failed', 'pending', 'awaiting_reply')
     RETURNING position, name, phone`,
    [runId]
  )
  return { run, recipients: recipients.rows.sort((a, b) => a.position - b.position) }
})

// Troca o rodízio. session_id acompanha a primeira da lista (relatório e eventos).
const updateRunSessions = async (runId, sessionIds) => {
  const result = await query(
    `UPDATE broadcast_runs SET session_ids = $2::text[], session_id = $3
     WHERE id = $1
     RETURNING ${RUN_COLUMNS}`,
    [runId, sessionIds, sessionIds[0]]
  )
  return result.rows[0] || null
}

// Novo ritmo vale para o restante do disparo (e para Retomar/Reprocessar depois)
const updateRunPacing = async (runId, { minSeconds, maxSeconds, randomOrder }) => {
  const result = await query(
    `UPDATE broadcast_runs SET delay_min_seconds = $2, delay_max_seconds = $3, random_order = $4
     WHERE id = $1
     RETURNING ${RUN_COLUMNS}`,
    [runId, minSeconds, maxSeconds, randomOrder]
  )
  return result.rows[0] || null
}

// Boot: disparos que estavam rodando quando o processo caiu não são retomados (evita mensagem duplicada)
const interruptRunningRuns = async () => {
  const result = await query(
    `UPDATE broadcast_runs
     SET status = 'interrupted', error = 'Servidor reiniciado durante o envio', finished_at = CURRENT_TIMESTAMP
     WHERE status = 'running'`
  )
  return result.rowCount
}

/**
 * Disparo programado: guarda só o que foi escolhido (lista, modelo ou texto/arquivo, ritmo, horário).
 * Destinatários e partes são montados no horário, com a lista e a mensagem como estiverem.
 */
const createScheduledRun = async (userId, { sessionId, sessionIds = [sessionId], listId, listName, templateId, templateName, text, fileId, fileName, pacing, scheduledAt }) => {
  const ids = sessionIds.length > 0 ? sessionIds : [sessionId]
  const result = await query(
    `INSERT INTO broadcast_runs (user_id, session_id, session_ids, list_id, list_name, template_id, template_name, text, file_id, file_name,
                                 total, status, scheduled_at, delay_min_seconds, delay_max_seconds, random_order)
     VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10, 0, 'scheduled', $11, $12, $13, $14)
     RETURNING ${RUN_COLUMNS}`,
    [userId, ids[0], ids, listId, listName, templateId, templateName, text, fileId, fileName, scheduledAt,
      pacing.minSeconds, pacing.maxSeconds, pacing.randomOrder]
  )
  return result.rows[0]
}

const listDueScheduledRuns = async (now) => {
  const result = await query(
    `SELECT ${RUN_COLUMNS} FROM broadcast_runs WHERE status = 'scheduled' AND scheduled_at <= $1 ORDER BY scheduled_at, id`,
    [now]
  )
  return result.rows
}

// Reserva atômica: só um tick (ou processo) consegue passar o disparo de 'scheduled' para 'running'
const claimScheduledRun = async (runId) => {
  const result = await query(
    `UPDATE broadcast_runs SET status = 'running' WHERE id = $1 AND status = 'scheduled' RETURNING ${RUN_COLUMNS}`,
    [runId]
  )
  return result.rows[0] || null
}

// No horário: grava destinatários e a cópia das partes montados agora
const populateScheduledRun = (runId, { listName, templateName, text, fileName, recipients, parts }) => withTransaction(async (client) => {
  const runResult = await client.query(
    `UPDATE broadcast_runs
     SET total = $2, list_name = $3, template_name = $4, text = $5, file_name = $6, parts = $7::jsonb
     WHERE id = $1
     RETURNING ${RUN_COLUMNS}`,
    [runId, recipients.length, listName, templateName, text, fileName, JSON.stringify(parts)]
  )
  await client.query(
    `INSERT INTO broadcast_run_recipients (run_id, position, name, phone)
     SELECT $1, ordinality - 1, name, phone
     FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS r(name, phone, ordinality)`,
    [runId, recipients.map((recipient) => recipient.name), recipients.map((recipient) => recipient.phone)]
  )
  return runResult.rows[0]
})

const cancelScheduledRun = async (runId) => {
  const result = await query(
    `UPDATE broadcast_runs SET status = 'canceled', error = 'Programação cancelada pelo usuário', finished_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'scheduled'
     RETURNING ${RUN_COLUMNS}`,
    [runId]
  )
  return result.rows[0] || null
}

// Condicional: não fecha um pausado que acabou de ser retomado (corrida Retomar × Cancelar)
const cancelPausedRun = async (runId, reason) => {
  const result = await query(
    `UPDATE broadcast_runs SET status = 'canceled', error = $2, finished_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'paused'
     RETURNING ${RUN_COLUMNS}`,
    [runId, truncateError(reason)]
  )
  return result.rows[0] || null
}

// Run em awaiting: marca awaiting_reply restantes e encerra
const cancelAwaitingRun = async (runId, reason) => withTransaction(async (client) => {
  await client.query(
    `UPDATE broadcast_run_recipients
     SET status = 'failed', error = $2
     WHERE run_id = $1 AND status = 'awaiting_reply'`,
    [runId, truncateError(reason)]
  )
  const failedCount = await client.query(
    `SELECT COUNT(*)::int AS n FROM broadcast_run_recipients WHERE run_id = $1 AND status = 'failed'`,
    [runId]
  )
  const result = await client.query(
    `UPDATE broadcast_runs
     SET status = 'canceled', error = $2, failed = $3, finished_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'awaiting'
     RETURNING ${RUN_COLUMNS}`,
    [runId, truncateError(reason), failedCount.rows[0].n]
  )
  return result.rows[0] || null
})

// Reserva atômica para follow-up (resposta ou timeout 24h)
const claimAwaitingRecipient = async (runId, position) => {
  const result = await query(
    `UPDATE broadcast_run_recipients
     SET status = 'pending'
     WHERE run_id = $1 AND position = $2 AND status = 'awaiting_reply'
     RETURNING position, name, phone, greeting_session_id AS "greetingSessionId",
               greeting_sent_at AS "greetingSentAt"`,
    [runId, position]
  )
  return result.rows[0] || null
}

const claimAwaitingRecipientByPhone = async (sessionId, phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  const result = await query(
    `WITH picked AS (
       SELECT r2.run_id, r2.position
       FROM broadcast_run_recipients r2
       JOIN broadcast_runs run ON run.id = r2.run_id
       WHERE r2.status = 'awaiting_reply'
         AND r2.greeting_session_id = $1
         AND run.status IN ('awaiting', 'running', 'paused')
         AND (r2.phone = $2 OR r2.phone LIKE '%' || $2 OR $2 LIKE '%' || r2.phone)
       ORDER BY r2.greeting_sent_at, r2.run_id, r2.position
       LIMIT 1
     )
     UPDATE broadcast_run_recipients r
     SET status = 'pending'
     FROM picked
     WHERE r.run_id = picked.run_id AND r.position = picked.position AND r.status = 'awaiting_reply'
     RETURNING r.run_id AS "runId", r.position, r.name, r.phone,
               r.greeting_session_id AS "greetingSessionId"`,
    [sessionId, digits]
  )
  if (!result.rows[0]) return null
  const run = await query(
    `SELECT user_id AS "userId", session_id AS "sessionId" FROM broadcast_runs WHERE id = $1`,
    [result.rows[0].runId]
  )
  return { ...result.rows[0], userId: run.rows[0]?.userId, sessionId: run.rows[0]?.sessionId }
}

const listDueAwaitingRecipients = async (before) => {
  const result = await query(
    `SELECT r.run_id AS "runId", r.position, r.name, r.phone,
            r.greeting_session_id AS "greetingSessionId", run.user_id AS "userId",
            run.session_id AS "sessionId"
     FROM broadcast_run_recipients r
     JOIN broadcast_runs run ON run.id = r.run_id
     WHERE r.status = 'awaiting_reply'
       AND r.greeting_sent_at <= $1
       AND run.status IN ('awaiting', 'running', 'paused')
     ORDER BY r.greeting_sent_at, r.run_id, r.position
     LIMIT 50`,
    [before]
  )
  return result.rows
}

const listPolicyPausedRuns = async () => {
  const result = await query(
    `SELECT ${RUN_COLUMNS} FROM broadcast_runs
     WHERE status = 'paused' AND pause_code IN ('quiet', 'cap')
     ORDER BY id`
  )
  return result.rows
}

// Retoma só quem ficou pendente. Falha, supressão, duplicata e resposta não voltam para a fila.
const claimPausedForResume = (runId) => withTransaction(async (client) => {
  const runResult = await client.query(
    `UPDATE broadcast_runs
     SET status = 'running', error = NULL, pause_code = NULL, finished_at = NULL
     WHERE id = $1 AND status = 'paused' AND pause_code IN ('quiet', 'cap')
     RETURNING ${RUN_COLUMNS}`,
    [runId]
  )
  const run = runResult.rows[0]
  if (!run) return null
  const recipients = await client.query(
    `SELECT position, name, phone
     FROM broadcast_run_recipients
     WHERE run_id = $1 AND status = 'pending'
     ORDER BY position`,
    [runId]
  )
  if (recipients.rows.length === 0) {
    const closed = await client.query(
      `UPDATE broadcast_runs
       SET status = 'done', error = NULL, pause_code = NULL, finished_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${RUN_COLUMNS}`,
      [runId]
    )
    return { run: closed.rows[0], recipients: [] }
  }
  return { run, recipients: recipients.rows }
})

module.exports = {
  cancelPausedRun,
  cancelAwaitingRun,
  updateRunPacing,
  updateRunSessions,
  createScheduledRun,
  listDueScheduledRuns,
  claimScheduledRun,
  populateScheduledRun,
  cancelScheduledRun,
  createRun,
  recordRecipientResult,
  finishRun,
  tryCloseAwaitingRun,
  claimAwaitingRecipient,
  claimAwaitingRecipientByPhone,
  listDueAwaitingRecipients,
  listRuns,
  findRun,
  reopenRunForRetry,
  interruptRunningRuns,
  listPolicyPausedRuns,
  claimPausedForResume
}
