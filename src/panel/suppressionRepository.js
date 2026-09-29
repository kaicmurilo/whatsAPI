const { query } = require('../database')
const { normalizePhone, alternatePhone, phoneFromChatId } = require('./phone')
const { matchedKeyword, suppressionToken } = require('./sendPolicy')
const { getSettings } = require('./settingsRepository')

const SUPPRESSED_COLUMNS = 'id, phone, keyword, requested_at AS "requestedAt"'

const phoneForms = (phone) => {
  const normalized = normalizePhone(String(phone)) || null
  if (!normalized) return []
  const alt = alternatePhone(normalized)
  return alt ? [normalized, alt] : [normalized]
}

const findSuppression = async (userId, phones) => {
  if (phones.length === 0) return null
  const result = await query(
    `SELECT keyword FROM suppressed_numbers
     WHERE user_id = $1 AND (phone = ANY($2::text[]) OR phone_alt = ANY($2::text[]))
     LIMIT 1`,
    [userId, phones]
  )
  return result.rows[0] || null
}

const rememberSuppression = async (userId, phone, keyword) => {
  const forms = phoneForms(phone)
  if (forms.length === 0) return null
  const [primary, alt] = forms
  const result = await query(
    `INSERT INTO suppressed_numbers (user_id, phone, phone_alt, keyword)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, phone) DO UPDATE
       SET keyword = EXCLUDED.keyword, requested_at = CURRENT_TIMESTAMP, phone_alt = EXCLUDED.phone_alt
     RETURNING ${SUPPRESSED_COLUMNS}`,
    [userId, primary, alt || null, keyword.slice(0, 32)]
  )
  return result.rows[0]
}

const listSuppressed = async (userId, { page, perPage, search }) => {
  const result = await query(
    `SELECT ${SUPPRESSED_COLUMNS}, COUNT(*) OVER() AS total
     FROM suppressed_numbers
     WHERE user_id = $1
       AND ($2::text IS NULL OR phone ILIKE $2 OR keyword ILIKE $2)
     ORDER BY requested_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [userId, search ? `%${search}%` : null, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...row }) => row)
  return { items, total, page, perPage }
}

const removeSuppressed = async (userId, id) => {
  const result = await query(
    'DELETE FROM suppressed_numbers WHERE user_id = $1 AND id = $2',
    [userId, id]
  )
  return result.rowCount > 0
}

const userIdOfSession = async (sessionId) => {
  const result = await query('SELECT user_id AS "userId" FROM whatsapp_sessions WHERE session_id = $1', [sessionId])
  return result.rows[0]?.userId || null
}

// Mensagem recebida que é só a palavra configurada entra na supressão da conta
const noteSuppressionKeyword = async (sessionId, message) => {
  if (!message || message.fromMe || typeof message.body !== 'string' || typeof message.chatId !== 'string') return
  if (!suppressionToken(message.body)) return
  const phone = phoneFromChatId(message.chatId)
  if (!phone) return
  const userId = await userIdOfSession(sessionId)
  if (!userId) return
  const settings = await getSettings(userId)
  if (!settings.suppressionEnabled) return
  const keyword = matchedKeyword(message.body, settings.suppressionKeywords)
  if (!keyword) return
  const saved = await rememberSuppression(userId, phone, keyword)
  if (saved) console.log(`[panel] supressão user=${userId} phone=${saved.phone} palavra=${saved.keyword}`)
}

const hasReplySince = async (userId, phones, since) => {
  if (phones.length === 0) return false
  const result = await query(
    `SELECT 1
     FROM whatsapp_messages m
     JOIN whatsapp_sessions s ON s.session_id = m.session_id
     WHERE s.user_id = $1
       AND m.from_me = false
       AND m.sent_at >= $2
       AND split_part(m.chat_id, '@', 1) = ANY($3::text[])
     LIMIT 1`,
    [userId, since, phones]
  )
  return result.rows.length > 0
}

module.exports = {
  phoneForms, findSuppression, rememberSuppression, listSuppressed, removeSuppressed, noteSuppressionKeyword, hasReplySince
}
