const crypto = require('crypto')
const { query } = require('../database')

// Prefixo distingue a chave de um JWT no mesmo header Authorization
const API_KEY_PREFIX = 'wak_'
const VISIBLE_PREFIX_LENGTH = API_KEY_PREFIX.length + 6
// Gravar o uso a cada request seria uma escrita por chamada da aplicação
const LAST_USED_RESOLUTION_MS = 60 * 1000

const CREDENTIAL_COLUMNS = 'id, name, token_prefix AS "tokenPrefix", session_ids AS "sessionIds", created_at AS "createdAt", last_used_at AS "lastUsedAt"'

// Chave de 256 bits aleatórios: SHA-256 basta (não é senha escolhida por gente) e permite busca por índice
const hashApiKey = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex')

const isApiKey = (token) => typeof token === 'string' && token.startsWith(API_KEY_PREFIX)

const generateApiKey = () => `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`

/**
 * Cria a credencial e devolve a chave em texto — única vez em que ela existe fora da aplicação.
 */
const createApiCredential = async (userId, name, sessionIds = null) => {
  const apiKey = generateApiKey()
  const result = await query(
    `INSERT INTO api_credentials (user_id, name, token_hash, token_prefix, session_ids)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CREDENTIAL_COLUMNS}`,
    [userId, name, hashApiKey(apiKey), apiKey.slice(0, VISIBLE_PREFIX_LENGTH), sessionIds]
  )
  return { ...result.rows[0], apiKey }
}

const listApiCredentials = async (userId, { page, perPage, search }) => {
  const result = await query(
    `SELECT ${CREDENTIAL_COLUMNS}, COUNT(*) OVER() AS total
     FROM api_credentials
     WHERE user_id = $1
       AND ($2::text IS NULL OR name ILIKE $2)
     ORDER BY created_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [userId, search ? `%${search}%` : null, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...row }) => row)
  return { items, total, page, perPage }
}

const countOwnedSessions = async (userId, sessionIds) => {
  const result = await query(
    'SELECT COUNT(*)::int AS owned FROM whatsapp_sessions WHERE user_id = $1 AND session_id = ANY($2::text[])',
    [userId, sessionIds]
  )
  return result.rows[0].owned
}

const revokeApiCredential = async (userId, id) => {
  const result = await query('DELETE FROM api_credentials WHERE user_id = $1 AND id = $2', [userId, id])
  return result.rowCount > 0
}

const touchLastUsed = (credential) => {
  const lastUsedAt = credential.last_used_at ? new Date(credential.last_used_at).getTime() : 0
  if (Date.now() - lastUsedAt < LAST_USED_RESOLUTION_MS) return
  query('UPDATE api_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [credential.id])
    .catch((error) => console.error(`[auth] falha ao registrar uso da credencial id=${credential.id}:`, error.message))
}

/**
 * @returns {Promise<{ id: number, user_id: string, session_ids: string[] | null } | null>} credencial ativa dona da chave
 */
const findApiCredentialByKey = async (apiKey) => {
  const result = await query(
    'SELECT id, user_id, session_ids, last_used_at FROM api_credentials WHERE token_hash = $1',
    [hashApiKey(apiKey)]
  )
  const credential = result.rows[0]
  if (!credential) return null
  touchLastUsed(credential)
  return credential
}

module.exports = { isApiKey, createApiCredential, listApiCredentials, revokeApiCredential, findApiCredentialByKey, countOwnedSessions }
