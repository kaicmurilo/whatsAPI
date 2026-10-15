const { query } = require('../database')

const CACHE_TTL_HOURS = 24

/**
 * Grava o retrato atual dos grupos de uma instância e remove os que sumiram dele (saiu/foi removida).
 * @returns {Promise<{ saved: number, removed: number }>}
 */
const replaceSessionGroups = async (sessionId, groups, refreshedAt) => {
  const rows = groups.map((group) => ({ chat_id: group.chatId, name: group.name, size: group.size, is_admin: group.isAdmin, admins: group.admins }))
  const saved = await query(
    `INSERT INTO whatsapp_group_cache (session_id, chat_id, name, participants_count, is_admin, admins, refreshed_at)
     SELECT $1, g.chat_id, LEFT(g.name, 255), g.size, g.is_admin, g.admins, $3
     FROM jsonb_to_recordset($2::jsonb) AS g(chat_id text, name text, size int, is_admin boolean, admins jsonb)
     ON CONFLICT (session_id, chat_id) DO UPDATE SET
       name = EXCLUDED.name, participants_count = EXCLUDED.participants_count,
       is_admin = EXCLUDED.is_admin, admins = EXCLUDED.admins, refreshed_at = EXCLUDED.refreshed_at`,
    [sessionId, JSON.stringify(rows), refreshedAt]
  )
  const removed = await query('DELETE FROM whatsapp_group_cache WHERE session_id = $1 AND refreshed_at < $2', [sessionId, refreshedAt])
  return { saved: saved.rowCount, removed: removed.rowCount }
}

// Instância fora do ar há mais de 24h: o retrato dela deixa de valer
const deleteExpiredGroups = async () => {
  const result = await query(`DELETE FROM whatsapp_group_cache WHERE refreshed_at < CURRENT_TIMESTAMP - make_interval(hours => ${CACHE_TTL_HOURS})`)
  return result.rowCount
}

// Junta o retrato de todas as instâncias do usuário por grupo. allowedSessionIds (credencial restrita) limita as instâncias.
const GROUPED = `
  SELECT c.chat_id AS "chatId",
         (array_agg(c.name ORDER BY c.refreshed_at DESC) FILTER (WHERE c.name IS NOT NULL))[1] AS name,
         MAX(c.participants_count)::int AS "participantsCount",
         (array_agg(c.admins ORDER BY c.refreshed_at DESC))[1] AS admins,
         array_agg(c.session_id ORDER BY c.session_id) AS "memberSessionIds",
         COALESCE(array_agg(c.session_id ORDER BY c.session_id) FILTER (WHERE c.is_admin), '{}') AS "adminSessionIds",
         MAX(c.refreshed_at) AS "refreshedAt"
  FROM whatsapp_group_cache c
  JOIN whatsapp_sessions s ON s.session_id = c.session_id
  WHERE s.user_id = $1 AND ($2::text[] IS NULL OR c.session_id = ANY($2::text[]))
  GROUP BY c.chat_id`

const listCachedGroups = async (userId, { page, perPage, search, allowedSessionIds = null, adminOnly = false }) => {
  const result = await query(
    `SELECT g.*, COUNT(*) OVER() AS total FROM (${GROUPED}) g
     WHERE ($3::text IS NULL OR g.name ILIKE $3 OR g."chatId" ILIKE $3)
       AND (NOT $4::boolean OR cardinality(g."adminSessionIds") > 0)
     ORDER BY g.name NULLS LAST, g."chatId"
     LIMIT $5 OFFSET $6`,
    [userId, allowedSessionIds, search ? `%${search}%` : null, adminOnly, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  return { items: result.rows.map(({ total: _total, ...row }) => row), total, page, perPage }
}

const findCachedGroup = async (userId, chatId, allowedSessionIds = null) => {
  const result = await query(`SELECT g.* FROM (${GROUPED}) g WHERE g."chatId" = $3`, [userId, allowedSessionIds, chatId])
  return result.rows[0] || null
}

// Última atualização e quantos grupos a conta tem em cache (cabeçalho da tela)
const groupCacheStatus = async (userId) => {
  const result = await query(
    `SELECT COUNT(DISTINCT c.chat_id)::int AS groups, MAX(c.refreshed_at) AS "refreshedAt"
     FROM whatsapp_group_cache c JOIN whatsapp_sessions s ON s.session_id = c.session_id WHERE s.user_id = $1`,
    [userId]
  )
  return result.rows[0]
}

module.exports = { CACHE_TTL_HOURS, replaceSessionGroups, deleteExpiredGroups, listCachedGroups, findCachedGroup, groupCacheStatus }
