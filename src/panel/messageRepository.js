const { query } = require('../database')

const MESSAGE_COLUMNS = `
  id, message_id AS "messageId", chat_id AS "chatId", chat_name AS "chatName",
  from_me AS "fromMe", author, sender_name AS "senderName", type, body,
  has_media AS "hasMedia", media_mimetype AS "mediaMimetype",
  media_filename AS "mediaFilename", sent_at AS "sentAt"
`

// Retorna o registro salvo, ou null se a mensagem já existia (evento duplicado)
const saveMessage = async (record) => {
  const result = await query(
    `INSERT INTO whatsapp_messages
      (session_id, message_id, chat_id, chat_name, from_me, author, sender_name, type, body,
       has_media, media_mimetype, media_filename, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (session_id, message_id) DO NOTHING
     RETURNING ${MESSAGE_COLUMNS}`,
    [record.sessionId, record.messageId, record.chatId, record.chatName, record.fromMe,
      record.author, record.senderName, record.type, record.body, record.hasMedia,
      record.mediaMimetype, record.mediaFilename, record.sentAt]
  )
  return result.rows[0] || null
}

// Uma linha por chat com a última mensagem + nome da agenda do usuário (se houver).
// Paginação por página porque a lista é ordenada por atividade.
const listChats = async (sessionId, userId, { page, perPage, search }) => {
  const result = await query(
    `WITH last_message AS (
       SELECT DISTINCT ON (chat_id)
         chat_id, chat_name, body, type, from_me, sent_at
       FROM whatsapp_messages
       WHERE session_id = $1
       ORDER BY chat_id, sent_at DESC, id DESC
     ),
     named_chat AS (
       SELECT lm.chat_id, lm.body, lm.type, lm.from_me, lm.sent_at, contact.name AS contact_name,
              -- getChat() falha em chats @lid: sem nome do chat, usa o último remetente conhecido
              COALESCE(lm.chat_name, (
                SELECT s.sender_name FROM whatsapp_messages s
                WHERE s.session_id = $1 AND s.chat_id = lm.chat_id AND s.sender_name IS NOT NULL
                ORDER BY s.sent_at DESC
                LIMIT 1
              )) AS chat_name
       FROM last_message lm
       LEFT JOIN LATERAL (
         SELECT c.name
         FROM panel_contacts c
         WHERE c.user_id = $5
           AND lm.chat_id LIKE '%@c.us'
           AND split_part(lm.chat_id, '@', 1) IN (c.phone, c.phone_alt)
         ORDER BY (c.phone = split_part(lm.chat_id, '@', 1)) DESC
         LIMIT 1
       ) contact ON true
     )
     SELECT chat_id AS "chatId", chat_name AS "chatName", contact_name AS "contactName",
            body AS "lastBody", type AS "lastType", from_me AS "lastFromMe", sent_at AS "lastSentAt",
            COUNT(*) OVER() AS total
     FROM named_chat
     WHERE $2::text IS NULL OR chat_name ILIKE $2 OR chat_id ILIKE $2 OR contact_name ILIKE $2
     ORDER BY sent_at DESC
     LIMIT $3 OFFSET $4`,
    [sessionId, search ? `%${search}%` : null, perPage, (page - 1) * perPage, userId]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...chat }) => chat)
  return { items, total, page, perPage }
}

// Ordem cronológica real (sent_at) com id de desempate: o histórico importado entra no banco
// depois das mensagens ao vivo, então a ordem de inserção não serve. Cursor keyset pelo par (sent_at, id).
const listMessages = async (sessionId, chatId, { beforeId, limit }) => {
  const result = await query(
    `SELECT ${MESSAGE_COLUMNS}
     FROM whatsapp_messages m
     WHERE session_id = $1 AND chat_id = $2
       AND ($3::bigint IS NULL OR (m.sent_at, m.id) < (
         SELECT cursor.sent_at, cursor.id FROM whatsapp_messages cursor
         WHERE cursor.id = $3 AND cursor.session_id = $1
       ))
     ORDER BY sent_at DESC, id DESC
     LIMIT $4`,
    [sessionId, chatId, beforeId, limit + 1]
  )
  const hasMore = result.rows.length > limit
  const items = result.rows.slice(0, limit)
  return { items, nextBeforeId: hasMore ? items[items.length - 1].id : null }
}

const isSessionOwnedBy = async (sessionId, userId) => {
  const result = await query(
    'SELECT 1 FROM whatsapp_sessions WHERE session_id = $1 AND user_id = $2',
    [sessionId, userId]
  )
  return result.rows.length > 0
}

module.exports = { saveMessage, listChats, listMessages, isSessionOwnedBy }
