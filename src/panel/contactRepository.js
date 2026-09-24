const { query } = require('../database')
const { phoneFromChatId } = require('./phone')

const CONTACT_COLUMNS = 'id, name, phone, created_at AS "createdAt", updated_at AS "updatedAt"'

// Busca casa no nome; se o termo tiver dígitos, também casa no telefone ("(11) 9999" → "119999")
const buildContactSearch = (search) => {
  if (!search) return { namePattern: null, phonePattern: null }
  const digits = search.replace(/\D/g, '')
  return { namePattern: `%${search}%`, phonePattern: digits ? `%${digits}%` : null }
}

const listContacts = async (userId, { page, perPage, search }) => {
  const { namePattern, phonePattern } = buildContactSearch(search)
  const result = await query(
    `SELECT ${CONTACT_COLUMNS}, COUNT(*) OVER() AS total
     FROM panel_contacts
     WHERE user_id = $1
       AND ($2::text IS NULL OR name ILIKE $2 OR ($3::text IS NOT NULL AND phone LIKE $3))
     ORDER BY name, id
     LIMIT $4 OFFSET $5`,
    [userId, namePattern, phonePattern, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...contact }) => contact)
  return { items, total, page, perPage }
}

// Mesmo telefone salvo de novo atualiza o nome (evita duplicata e dispensa endpoint de edição)
const upsertContact = async (userId, { name, phone, phoneAlt }) => {
  const result = await query(
    `INSERT INTO panel_contacts (user_id, name, phone, phone_alt)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, phone) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
     RETURNING ${CONTACT_COLUMNS}, (xmax = 0) AS "wasCreated"`,
    [userId, name, phone, phoneAlt]
  )
  return result.rows[0]
}

const deleteContact = async (userId, contactId) => {
  const result = await query('DELETE FROM panel_contacts WHERE user_id = $1 AND id = $2', [userId, contactId])
  return result.rowCount > 0
}

// Nome da agenda para um chat individual; prefere o telefone exato à variante do 9º dígito
const findContactNameForChat = async (userId, chatId) => {
  const phone = phoneFromChatId(chatId)
  if (!phone) return null
  const result = await query(
    `SELECT name FROM panel_contacts
     WHERE user_id = $1 AND $2 IN (phone, phone_alt)
     ORDER BY (phone = $2) DESC
     LIMIT 1`,
    [userId, phone]
  )
  return result.rows[0]?.name || null
}

module.exports = { listContacts, upsertContact, deleteContact, findContactNameForChat }
