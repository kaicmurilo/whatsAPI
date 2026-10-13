const { query } = require('../database')
const { isGroupChatId } = require('./groupMembership')
const { serializeMessageId } = require('./messageMapper')

/**
 * Registra um envio feito pela integração. Fire-and-forget: falha no registro não desfaz o envio,
 * só deixa de contar no balanceamento e no dashboard (fica no log).
 * `message` pode vir undefined: o whatsapp-web.js às vezes não devolve a mensagem enviada.
 */
const recordApiSend = ({ sessionId, chatId, message, credentialId }) => {
  const messageId = message ? serializeMessageId(message) : null
  query(
    'INSERT INTO api_sent_messages (session_id, message_id, chat_id, is_group, credential_id) VALUES ($1, $2, $3, $4, $5)',
    [sessionId, messageId, chatId, isGroupChatId(chatId), credentialId || null]
  ).catch((error) => console.error(`[send] falha ao registrar envio da integração sessão=${sessionId}:`, error.message))
}

// Envios da integração no dia por instância e o último (qualquer dia), no formato do pickByDailyLoad.
// Quem não enviou não aparece.
const loadDailyApiSends = async (sessionIds, dayStart, dayEnd) => {
  if (sessionIds.length === 0) return new Map()
  const result = await query(
    `SELECT session_id AS "sessionId",
            COUNT(*) FILTER (WHERE sent_at >= $2 AND sent_at < $3)::int AS today,
            MAX(sent_at) AS "lastSentAt"
     FROM api_sent_messages
     WHERE session_id = ANY($1::text[])
     GROUP BY session_id`,
    [sessionIds, dayStart, dayEnd]
  )
  return new Map(result.rows.map((row) => [row.sessionId, { today: row.today, lastSentAt: row.lastSentAt }]))
}

module.exports = { recordApiSend, loadDailyApiSends }
