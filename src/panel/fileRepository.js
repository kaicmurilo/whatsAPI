const { query } = require('../database')

const FILE_COLUMNS = 'id, original_name AS "name", mimetype, size_bytes AS "sizeBytes", created_at AS "createdAt"'

const listFiles = async (userId, { page, perPage, search }) => {
  const result = await query(
    `SELECT ${FILE_COLUMNS}, COUNT(*) OVER() AS total
     FROM panel_files
     WHERE user_id = $1 AND ($2::text IS NULL OR original_name ILIKE $2)
     ORDER BY created_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [userId, search ? `%${search}%` : null, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...file }) => file)
  return { items, total, page, perPage }
}

const createFile = async (userId, { name, mimetype, sizeBytes, storageKey }) => {
  const result = await query(
    `INSERT INTO panel_files (user_id, original_name, mimetype, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${FILE_COLUMNS}`,
    [userId, name, mimetype, sizeBytes, storageKey]
  )
  return result.rows[0]
}

// Inclui storage_key: uso interno (envio/remoção), nunca devolvido na API
const findOwnedFile = async (userId, fileId) => {
  const result = await query(
    `SELECT ${FILE_COLUMNS}, storage_key AS "storageKey" FROM panel_files WHERE user_id = $1 AND id = $2`,
    [userId, fileId]
  )
  return result.rows[0] || null
}

const deleteOwnedFile = async (userId, fileId) => {
  const result = await query(
    'DELETE FROM panel_files WHERE user_id = $1 AND id = $2 RETURNING storage_key AS "storageKey"',
    [userId, fileId]
  )
  return result.rows[0]?.storageKey || null
}

module.exports = { listFiles, createFile, findOwnedFile, deleteOwnedFile }
