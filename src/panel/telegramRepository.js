const { query, withTransaction } = require('../database')
const { alternatePhone } = require('./phone')

const BOT_COLUMNS = 'b.id::text AS id, b.user_id AS "userId", b.username, b.created_at AS "createdAt"'

/**
 * Salva o bot (token renovado substitui o antigo). Bot de outra conta não é tomado.
 * @returns {Promise<object|null>} null se o bot já pertence a outro usuário
 */
const saveTelegramBot = async (userId, { id, username, token }) => {
  const result = await query(
    `INSERT INTO telegram_bots AS b (id, user_id, username, token) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, token = EXCLUDED.token
     WHERE b.user_id = EXCLUDED.user_id
     RETURNING ${BOT_COLUMNS}`,
    [id, userId, username, token]
  )
  return result.rows[0] || null
}

const deleteTelegramBot = async (userId, botId) => {
  const result = await query('DELETE FROM telegram_bots WHERE user_id = $1 AND id = $2', [userId, botId])
  return result.rowCount > 0
}

// Token só sai daqui para ligar o polling no boot — nunca vai para o navegador
const listAllTelegramBots = async () => {
  const result = await query(`SELECT ${BOT_COLUMNS}, b.token FROM telegram_bots b`)
  return result.rows
}

const listUserTelegramBots = async (userId) => {
  const result = await query(
    `SELECT ${BOT_COLUMNS}, (SELECT COUNT(*) FROM telegram_bot_contacts l WHERE l.bot_id = b.id)::int AS "linkedContacts"
     FROM telegram_bots b WHERE b.user_id = $1 ORDER BY b.created_at, b.id`,
    [userId]
  )
  return result.rows
}

const listOwnedBotIds = async (userId, botIds) => {
  const result = await query('SELECT id::text AS id FROM telegram_bots WHERE user_id = $1 AND id = ANY($2::bigint[])', [userId, botIds])
  return new Set(result.rows.map((row) => row.id))
}

// Bots que este contato abriu (telefone exato primeiro, depois a variante do 9º dígito)
const findTelegramLinks = async (userId, phone) => {
  const result = await query(
    `SELECT l.bot_id::text AS "botId", c.telegram_chat_id::text AS "chatId"
     FROM panel_contacts c JOIN telegram_bot_contacts l ON l.contact_id = c.id
     WHERE c.user_id = $1 AND $2 IN (c.phone, c.phone_alt) AND c.telegram_chat_id IS NOT NULL
     ORDER BY (c.phone = $2) DESC`,
    [userId, phone]
  )
  return result.rows
}

const upsertTelegramContact = async (client, userId, { phone, chatId, name }) => {
  const updated = await client.query(
    `UPDATE panel_contacts SET telegram_chat_id = $3, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND $2 IN (phone, phone_alt) RETURNING id`,
    [userId, phone, chatId]
  )
  if (updated.rows.length > 0) return { contactIds: updated.rows.map((row) => row.id), created: false }
  const inserted = await client.query(
    `INSERT INTO panel_contacts (user_id, name, phone, phone_alt, telegram_chat_id) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, phone) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [userId, name, phone, alternatePhone(phone), chatId]
  )
  return { contactIds: [inserted.rows[0].id], created: true }
}

// Quantos destes telefones abriram algum dos bots (telefone exato ou variante do 9º dígito)
const countPhonesLinkedToBots = async (userId, botIds, phones) => {
  const result = await query(
    `SELECT COUNT(DISTINCT c.id)::int AS linked
     FROM panel_contacts c JOIN telegram_bot_contacts l ON l.contact_id = c.id
     WHERE c.user_id = $1 AND l.bot_id = ANY($2::bigint[]) AND c.telegram_chat_id IS NOT NULL
       AND (c.phone = ANY($3::text[]) OR c.phone_alt = ANY($3::text[]))`,
    [userId, botIds, phones]
  )
  return result.rows[0].linked
}

/**
 * Contato compartilhou o telefone com este bot: grava o chat na agenda (telefone ou 9º dígito) e marca que abriu o bot.
 * Quem não está na agenda entra com o nome do Telegram.
 * @returns {Promise<'linked' | 'created'>}
 */
const linkTelegramChat = (userId, botId, contact) => withTransaction(async (client) => {
  const { contactIds, created } = await upsertTelegramContact(client, userId, contact)
  await client.query(
    'INSERT INTO telegram_bot_contacts (bot_id, contact_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING',
    [botId, contactIds]
  )
  return created ? 'created' : 'linked'
})

module.exports = {
  saveTelegramBot,
  deleteTelegramBot,
  listAllTelegramBots,
  listUserTelegramBots,
  listOwnedBotIds,
  findTelegramLinks,
  linkTelegramChat,
  countPhonesLinkedToBots
}
