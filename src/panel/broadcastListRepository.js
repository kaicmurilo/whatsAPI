const { query, withTransaction } = require('../database')
const { alternatePhone } = require('./phone')

const listBroadcastLists = async (userId, { page, perPage, search }) => {
  const result = await query(
    `SELECT l.id, l.name, l.updated_at AS "updatedAt",
            (SELECT COUNT(*) FROM broadcast_list_members m WHERE m.list_id = l.id)::int AS "memberCount",
            COUNT(*) OVER() AS total
     FROM broadcast_lists l
     WHERE l.user_id = $1 AND ($2::text IS NULL OR l.name ILIKE $2)
     ORDER BY l.name, l.id
     LIMIT $3 OFFSET $4`,
    [userId, search ? `%${search}%` : null, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...list }) => list)
  return { items, total, page, perPage }
}

const findBroadcastList = async (userId, listId) => {
  const listResult = await query('SELECT id, name FROM broadcast_lists WHERE user_id = $1 AND id = $2', [userId, listId])
  const list = listResult.rows[0]
  if (!list) return null
  const members = await query(
    `SELECT c.id, c.name, c.phone
     FROM broadcast_list_members m JOIN panel_contacts c ON c.id = m.contact_id
     WHERE m.list_id = $1
     ORDER BY c.name, c.id`,
    [listId]
  )
  return { ...list, members: members.rows }
}

// Só aceita contatos da agenda do próprio usuário; devolve quantos dos ids pedidos são dele
const countOwnedContacts = async (client, userId, contactIds) => {
  const result = await client.query(
    'SELECT COUNT(*)::int AS owned FROM panel_contacts WHERE user_id = $1 AND id = ANY($2::bigint[])',
    [userId, contactIds]
  )
  return result.rows[0].owned
}

const replaceMembers = async (client, listId, contactIds) => {
  await client.query('DELETE FROM broadcast_list_members WHERE list_id = $1', [listId])
  await client.query(
    'INSERT INTO broadcast_list_members (list_id, contact_id) SELECT $1, unnest($2::bigint[])',
    [listId, contactIds]
  )
}

/**
 * Cria (listId null) ou substitui nome + membros de uma lista.
 * @returns {{ list?: object, error?: 'not_found' | 'foreign_contacts' }}
 */
const saveBroadcastList = (userId, { listId, name, contactIds }) => withTransaction(async (client) => {
  if (await countOwnedContacts(client, userId, contactIds) !== contactIds.length) return { error: 'foreign_contacts' }

  const saved = listId
    ? await client.query(
      'UPDATE broadcast_lists SET name = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id = $2 RETURNING id, name',
      [userId, listId, name]
    )
    : await client.query('INSERT INTO broadcast_lists (user_id, name) VALUES ($1, $2) RETURNING id, name', [userId, name])
  const list = saved.rows[0]
  if (!list) return { error: 'not_found' }

  await replaceMembers(client, list.id, contactIds)
  return { list: { ...list, memberCount: contactIds.length } }
})

const deleteBroadcastList = async (userId, listId) => {
  const result = await query('DELETE FROM broadcast_lists WHERE user_id = $1 AND id = $2', [userId, listId])
  return result.rowCount > 0
}

const MAX_LIST_NAME_LENGTH = 100

// "INTERIOR" já existe → "INTERIOR (2)", "INTERIOR (3)"… Importação nunca sobrescreve uma lista.
const pickAvailableListName = async (client, userId, baseName) => {
  const result = await client.query(
    'SELECT name FROM broadcast_lists WHERE user_id = $1 AND left(name, length($2::text)) = $2::text',
    [userId, baseName]
  )
  const taken = new Set(result.rows.map((row) => row.name))
  if (!taken.has(baseName)) return baseName
  for (let suffix = 2; ; suffix++) {
    const label = ` (${suffix})`
    const candidate = baseName.slice(0, MAX_LIST_NAME_LENGTH - label.length) + label
    if (!taken.has(candidate)) return candidate
  }
}

// Contato já existente = mesmo telefone ou a variante do 9º dígito (phone_alt)
const findExistingContactIds = async (client, userId, phones) => {
  const result = await client.query(
    `SELECT id, phone, phone_alt FROM panel_contacts
     WHERE user_id = $1 AND (phone = ANY($2::text[]) OR phone_alt = ANY($2::text[]))`,
    [userId, phones]
  )
  const idByPhone = new Map()
  for (const row of result.rows) {
    idByPhone.set(row.phone, row.id)
    if (row.phone_alt && !idByPhone.has(row.phone_alt)) idByPhone.set(row.phone_alt, row.id)
  }
  return idByPhone
}

const insertContacts = async (client, userId, entries) => {
  if (entries.length === 0) return new Map()
  const result = await client.query(
    `INSERT INTO panel_contacts (user_id, name, phone, phone_alt)
     SELECT $1, name, phone, NULLIF(phone_alt, '')
     FROM unnest($2::text[], $3::text[], $4::text[]) AS c(name, phone, phone_alt)
     ON CONFLICT (user_id, phone) DO NOTHING
     RETURNING id, phone`,
    [userId, entries.map((entry) => entry.name), entries.map((entry) => entry.phone), entries.map((entry) => alternatePhone(entry.phone) || '')]
  )
  return new Map(result.rows.map((row) => [row.phone, row.id]))
}

/**
 * Importa uma planilha já normalizada: reaproveita contatos existentes, cria os que faltam
 * e monta a lista (nome único). Tudo numa transação: ou importa inteiro ou nada muda.
 */
const importBroadcastList = (userId, { baseName, entries }) => withTransaction(async (client) => {
  const idByPhone = await findExistingContactIds(client, userId, entries.map((entry) => entry.phone))
  const newEntries = entries.filter((entry) => !idByPhone.has(entry.phone))
  const createdIds = await insertContacts(client, userId, newEntries)
  createdIds.forEach((id, phone) => idByPhone.set(phone, id))

  const contactIds = [...new Set(entries.map((entry) => idByPhone.get(entry.phone)).filter(Boolean))]
  const listName = await pickAvailableListName(client, userId, baseName)
  const listResult = await client.query('INSERT INTO broadcast_lists (user_id, name) VALUES ($1, $2) RETURNING id, name', [userId, listName])
  const list = listResult.rows[0]
  await client.query(
    'INSERT INTO broadcast_list_members (list_id, contact_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING',
    [list.id, contactIds]
  )
  return {
    list: { ...list, memberCount: contactIds.length },
    createdContacts: createdIds.size,
    reusedContacts: contactIds.length - createdIds.size
  }
})

module.exports = { listBroadcastLists, findBroadcastList, saveBroadcastList, deleteBroadcastList, importBroadcastList }
