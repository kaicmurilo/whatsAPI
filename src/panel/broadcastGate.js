const { reportTimeZone } = require('../config')
const { getSettings } = require('./settingsRepository')
const { phoneForms, findSuppression, hasReplySince } = require('./suppressionRepository')
const { query } = require('../database')
const {
  QUIET_PAUSE_ERROR, applyFirstNameToParts, isInsideSendWindow,
  zonedDayBounds, sessionsOverCap, canResumePolicy
} = require('./sendPolicy')

const countSentToday = async (sessionIds, dayStart, dayEnd) => {
  if (sessionIds.length === 0) return new Map()
  const result = await query(
    `SELECT sender_session_id AS "sessionId", COUNT(*)::int AS total
     FROM broadcast_run_recipients
     WHERE sender_session_id = ANY($1::text[])
       AND status = 'sent'
       AND sent_at >= $2 AND sent_at < $3
     GROUP BY sender_session_id`,
    [sessionIds, dayStart, dayEnd]
  )
  return new Map(result.rows.map((row) => [row.sessionId, row.total]))
}

// Envios do dia e o horário do último envio (qualquer dia). Quem nunca enviou não aparece.
const loadSendBalance = async (sessionIds, dayStart, dayEnd) => {
  if (sessionIds.length === 0) return new Map()
  const result = await query(
    `SELECT sender_session_id AS "sessionId",
            COUNT(*) FILTER (WHERE sent_at >= $2 AND sent_at < $3)::int AS today,
            MAX(sent_at) AS "lastSentAt"
     FROM broadcast_run_recipients
     WHERE sender_session_id = ANY($1::text[])
       AND status = 'sent'
       AND sent_at IS NOT NULL
     GROUP BY sender_session_id`,
    [sessionIds, dayStart, dayEnd]
  )
  return new Map(result.rows.map((row) => [row.sessionId, { today: row.today, lastSentAt: row.lastSentAt }]))
}

// Outro disparo da mesma conta, sobreposto no tempo, já mandou para este telefone
const hasOverlappingSend = async (userId, runId, position, phones, runCreatedAt) => {
  if (phones.length === 0) return false
  const result = await query(
    `SELECT 1
     FROM broadcast_run_recipients r
     JOIN broadcast_runs other ON other.id = r.run_id
     WHERE other.user_id = $1
       AND NOT (r.run_id = $2 AND r.position = $3)
       AND r.phone = ANY($4::text[])
       AND r.status = 'sent'
       AND (
         r.run_id = $2
         OR (
           other.created_at <= CURRENT_TIMESTAMP
           AND (other.finished_at IS NULL OR other.finished_at >= $5)
           AND $5 <= COALESCE(other.finished_at, CURRENT_TIMESTAMP)
         )
       )
     LIMIT 1`,
    [userId, runId, position, phones, runCreatedAt]
  )
  return result.rows.length > 0
}

/**
 * Regras consultadas a cada contato. Configuração é lida uma vez por disparo;
 * supressão, resposta, dedup e teto são consultados na hora.
 */
const createBroadcastGate = ({ userId, runId, createdAt }) => {
  let settingsPromise = null
  const settingsOf = () => {
    if (!settingsPromise) settingsPromise = getSettings(userId)
    return settingsPromise
  }

  const sentToday = async (sessionIds) => {
    const { start, end } = zonedDayBounds(new Date(), reportTimeZone)
    return countSentToday(sessionIds, start, end)
  }

  return {
    ready: () => settingsOf(),
    pauseForWindow: async (now) => {
      const settings = await settingsOf()
      if (!settings.quietHoursEnabled) return null
      if (isInsideSendWindow(now, settings, reportTimeZone)) return null
      return { code: 'quiet', error: QUIET_PAUSE_ERROR }
    },
    sessionsOverCap: async (sessionIds) => {
      const settings = await settingsOf()
      if (!settings.dailyCapEnabled) return new Set()
      return sessionsOverCap(sessionIds, await sentToday(sessionIds), settings.dailyCap)
    },
    sendLoad: async (sessionIds) => {
      const { start, end } = zonedDayBounds(new Date(), reportTimeZone)
      return loadSendBalance(sessionIds, start, end)
    },
    classify: async (recipient) => {
      const settings = await settingsOf()
      const phones = phoneForms(recipient.phone)
      if (settings.suppressionEnabled) {
        const hit = await findSuppression(userId, phones)
        if (hit) return { status: 'suppressed', error: `Pediu para sair (${hit.keyword})` }
      }
      if (settings.stopOnReply) {
        const replied = await hasReplySince(userId, phones, createdAt)
        if (replied) return { status: 'replied', error: 'Respondeu durante o disparo' }
      }
      if (await hasOverlappingSend(userId, runId, recipient.position, phones, createdAt)) {
        return { status: 'duplicate', error: 'Já recebe outro disparo desta conta' }
      }
      return null
    },
    personalize: async (parts, recipient) => {
      const settings = await settingsOf()
      if (!settings.prependFirstName) return parts
      return applyFirstNameToParts(parts, recipient.name)
    }
  }
}

const canResumeRun = async (run, now) => {
  const settings = await getSettings(run.userId)
  const sessionIds = Array.isArray(run.sessionIds) && run.sessionIds.length > 0 ? run.sessionIds : [run.sessionId]
  const { start, end } = zonedDayBounds(now, reportTimeZone)
  const sent = await countSentToday(sessionIds, start, end)
  return canResumePolicy({ settings, now, timeZone: reportTimeZone, sessionIds, sentToday: sent })
}

module.exports = { createBroadcastGate, canResumeRun }
