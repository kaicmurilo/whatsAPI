const { query } = require('../database')
const { PERIODS } = require('./metricsRanges')

const REPLY_WINDOW_DAYS = 7
const BOUNDED = ['today', 'yesterday', 'week', 'month', 'last30']
const PREFIX = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Week',
  month: 'Month',
  last30: 'Last30',
  all: 'All'
}

const PHONE_ALT_SQL = `CASE
  WHEN rr.phone LIKE '55%' AND char_length(rr.phone) = 13 AND substring(rr.phone FROM 5 FOR 1) = '9'
    THEN substring(rr.phone FROM 1 FOR 4) || substring(rr.phone FROM 6)
  WHEN rr.phone LIKE '55%' AND char_length(rr.phone) = 12 AND substring(rr.phone FROM 5 FOR 1) ~ '^[6-9]'
    THEN substring(rr.phone FROM 1 FOR 4) || '9' || substring(rr.phone FROM 5)
  ELSE NULL
END`

const num = (value) => Number(value ?? 0)

const windowClause = (indexes, period, column) => {
  if (period === 'all') return 'TRUE'
  const bound = indexes[period]
  return `${column} >= $${bound.start} AND ${column} < $${bound.end}`
}

const boundParams = (windows) => {
  const params = []
  const indexes = {}
  for (const period of BOUNDED) {
    params.push(windows[period].start)
    const start = params.length
    params.push(windows[period].end)
    indexes[period] = { start, end: params.length }
  }
  return { params, indexes }
}

const shiftIndexes = (indexes, offset) => {
  const shifted = {}
  for (const period of BOUNDED) {
    shifted[period] = { start: indexes[period].start + offset, end: indexes[period].end + offset }
  }
  return shifted
}

const sendSelectList = (indexes, { withFunnel }) => PERIODS.flatMap((period) => {
  const where = windowClause(indexes, period, 'sent_at')
  const prefix = PREFIX[period]
  const columns = [
    `COUNT(*) FILTER (WHERE ${where})::int AS "sent${prefix}"`,
    `COUNT(*) FILTER (WHERE delivered AND ${where})::int AS "delivered${prefix}"`,
    `COUNT(*) FILTER (WHERE read AND ${where})::int AS "read${prefix}"`,
    `COUNT(*) FILTER (WHERE replied AND ${where})::int AS "replied${prefix}"`
  ]
  if (withFunnel) {
    columns.push(
      `COUNT(*) FILTER (WHERE played AND ${where})::int AS "played${prefix}"`,
      `COUNT(DISTINCT phone) FILTER (WHERE ${where})::int AS "unique${prefix}"`
    )
  }
  return columns
}).join(', ')

const readBucket = (row, period, { withFunnel }) => {
  const prefix = PREFIX[period]
  const bucket = {
    sent: num(row[`sent${prefix}`]),
    delivered: num(row[`delivered${prefix}`]),
    read: num(row[`read${prefix}`]),
    replied: num(row[`replied${prefix}`])
  }
  if (!withFunnel) return bucket
  return {
    ...bucket,
    played: num(row[`played${prefix}`]),
    uniquePhones: num(row[`unique${prefix}`]),
    failed: 0,
    suppressed: 0,
    optOuts: 0,
    campaigns: 0
  }
}

const readPeriods = (row, options) => Object.fromEntries(PERIODS.map((period) => [period, readBucket(row, period, options)]))

// Envios de transmissão (status sent). Resposta = mensagem recebida do mesmo telefone em até 7 dias.
const loadSendMetrics = async (userId, windows, timeZone) => {
  const { params: bounds, indexes } = boundParams(windows)
  const sendIndexes = shiftIndexes(indexes, 2)
  const timeZoneIndex = bounds.length + 3
  const result = await query(
    `WITH sent AS (
       SELECT
         COALESCE(rr.sender_session_id, r.session_id) AS session_id,
         rr.phone,
         ${PHONE_ALT_SQL} AS phone_alt,
         rr.sent_at,
         rr.delivered_at IS NOT NULL AS delivered,
         rr.read_at IS NOT NULL AS read,
         rr.played_at IS NOT NULL AS played
       FROM broadcast_run_recipients rr
       JOIN broadcast_runs r ON r.id = rr.run_id
       WHERE r.user_id = $1
         AND rr.status = 'sent'
         AND rr.sent_at IS NOT NULL
     ),
     scoped AS MATERIALIZED (
       SELECT sent.*,
         EXISTS (
           SELECT 1
           FROM whatsapp_messages m
           JOIN whatsapp_sessions s ON s.session_id = m.session_id
           WHERE s.user_id = $1
             AND m.from_me = false
             AND m.sent_at >= sent.sent_at
             AND m.sent_at < sent.sent_at + make_interval(days => $2::int)
             AND (
               split_part(m.chat_id, '@', 1) = sent.phone
               OR (sent.phone_alt IS NOT NULL AND split_part(m.chat_id, '@', 1) = sent.phone_alt)
             )
         ) AS replied
       FROM sent
     )
     SELECT
       (SELECT row_to_json(totals) FROM (
          SELECT ${sendSelectList(sendIndexes, { withFunnel: true })}
          FROM scoped
        ) totals) AS totals,
       (SELECT COALESCE(json_agg(row_to_json(instances)), '[]'::json) FROM (
          SELECT session_id AS "sessionId", ${sendSelectList(sendIndexes, { withFunnel: false })}
          FROM scoped
          GROUP BY session_id
        ) instances) AS instances,
       (SELECT COALESCE(json_agg(row_to_json(days) ORDER BY days.day), '[]'::json) FROM (
          SELECT to_char(sent_at AT TIME ZONE $${timeZoneIndex}, 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS sent,
                 COUNT(*) FILTER (WHERE delivered)::int AS delivered,
                 COUNT(*) FILTER (WHERE read)::int AS read,
                 COUNT(*) FILTER (WHERE replied)::int AS replied
          FROM scoped
          WHERE ${windowClause(sendIndexes, 'last30', 'sent_at')}
          GROUP BY 1
        ) days) AS daily`,
    [userId, REPLY_WINDOW_DAYS, ...bounds, timeZone]
  )
  const row = result.rows[0]
  return {
    periods: readPeriods(row.totals ?? {}, { withFunnel: true }),
    instances: row.instances.map((instance) => ({
      sessionId: instance.sessionId,
      periods: readPeriods(instance, { withFunnel: false })
    })),
    daily: row.daily.map((day) => ({
      day: day.day,
      sent: num(day.sent),
      delivered: num(day.delivered),
      read: num(day.read),
      replied: num(day.replied)
    }))
  }
}

const outcomeSelectList = (indexes, column) => PERIODS.map((period) => {
  const where = windowClause(indexes, period, column)
  return `COUNT(*) FILTER (WHERE ${where})::int AS "${period}"`
}).join(', ')

const readOutcome = (row) => Object.fromEntries(PERIODS.map((period) => [period, num(row[period])]))

// Falha e supressão não têm horário próprio: contam no dia em que o disparo foi criado.
const loadOutcomes = async (userId, windows) => {
  const { params, indexes } = boundParams(windows)
  const outcomeIndexes = shiftIndexes(indexes, 1)
  const [failures, optOuts, campaigns] = await Promise.all([
    query(
      `SELECT
         ${PERIODS.map((period) => `COUNT(*) FILTER (WHERE rr.status = 'failed' AND ${windowClause(outcomeIndexes, period, 'r.created_at')})::int AS "failed_${period}"`).join(', ')},
         ${PERIODS.map((period) => `COUNT(*) FILTER (WHERE rr.status = 'suppressed' AND ${windowClause(outcomeIndexes, period, 'r.created_at')})::int AS "suppressed_${period}"`).join(', ')}
       FROM broadcast_run_recipients rr
       JOIN broadcast_runs r ON r.id = rr.run_id
       WHERE r.user_id = $1`,
      [userId, ...params]
    ),
    query(
      `SELECT ${outcomeSelectList(outcomeIndexes, 'requested_at')}
       FROM suppressed_numbers
       WHERE user_id = $1`,
      [userId, ...params]
    ),
    query(
      `SELECT ${outcomeSelectList(outcomeIndexes, 'created_at')},
              COUNT(*) FILTER (WHERE status = 'running')::int AS running,
              COUNT(*) FILTER (WHERE status = 'paused')::int AS paused,
              COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled
       FROM broadcast_runs
       WHERE user_id = $1`,
      [userId, ...params]
    )
  ])
  const failureRow = failures.rows[0]
  return {
    failed: Object.fromEntries(PERIODS.map((period) => [period, num(failureRow[`failed_${period}`])])),
    suppressed: Object.fromEntries(PERIODS.map((period) => [period, num(failureRow[`suppressed_${period}`])])),
    optOuts: readOutcome(optOuts.rows[0]),
    campaigns: readOutcome(campaigns.rows[0]),
    snapshot: {
      running: num(campaigns.rows[0].running),
      paused: num(campaigns.rows[0].paused),
      scheduled: num(campaigns.rows[0].scheduled)
    }
  }
}

module.exports = { REPLY_WINDOW_DAYS, loadSendMetrics, loadOutcomes }
