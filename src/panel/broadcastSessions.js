const { query } = require('../database')

const MAX_SESSIONS = 20
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{10,100}$/
// Bot do Telegram como instância: "telegram:<id do bot>". ":" nunca aparece em id de sessão do WhatsApp.
const TELEGRAM_INSTANCE_PATTERN = /^telegram:(\d{1,20})$/

// Conta de usuário do Telegram como instância: "tguser:<id do usuário no Telegram>"
const TELEGRAM_ACCOUNT_PATTERN = /^tguser:(\d{1,20})$/

const telegramInstanceId = (botId) => `telegram:${botId}`
const botIdOfInstance = (instanceId) => TELEGRAM_INSTANCE_PATTERN.exec(String(instanceId))?.[1] ?? null
const accountInstanceId = (accountId) => `tguser:${accountId}`
const accountIdOfInstance = (instanceId) => TELEGRAM_ACCOUNT_PATTERN.exec(String(instanceId))?.[1] ?? null
const isValidInstanceId = (value) => typeof value === 'string' &&
  (SESSION_ID_PATTERN.test(value) || TELEGRAM_INSTANCE_PATTERN.test(value) || TELEGRAM_ACCOUNT_PATTERN.test(value))

/**
 * Lista de instâncias do disparo. Ausente → a instância da URL (disparos de um número só).
 * @returns {{ sessionIds?: string[], error?: string }}
 */
const parseSessionIds = (value, fallbackSessionId) => {
  const raw = value === undefined || value === null ? [fallbackSessionId] : value
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Escolha ao menos uma instância' }
  if (raw.length > MAX_SESSIONS) return { error: `No máximo ${MAX_SESSIONS} instâncias por disparo` }
  const sessionIds = []
  for (const item of raw) {
    if (!isValidInstanceId(item)) return { error: 'Instância inválida' }
    if (!sessionIds.includes(item)) sessionIds.push(item)
  }
  return { sessionIds }
}

// Disparos antigos só têm session_id
const sessionsOf = (run) => {
  if (Array.isArray(run?.sessionIds) && run.sessionIds.length > 0) return run.sessionIds
  return run?.sessionId ? [run.sessionId] : []
}

const listOwnedSessionIds = async (userId, sessionIds) => {
  const result = await query(
    'SELECT session_id FROM whatsapp_sessions WHERE user_id = $1 AND session_id = ANY($2::text[])',
    [userId, sessionIds]
  )
  return new Set(result.rows.map((row) => row.session_id))
}

module.exports = { parseSessionIds, sessionsOf, listOwnedSessionIds, telegramInstanceId, botIdOfInstance, accountInstanceId, accountIdOfInstance, MAX_SESSIONS }
