const { query } = require('../database')

const ACCOUNT_COLUMNS = 'a.id::text AS id, a.user_id AS "userId", a.phone, a.label, a.cooldown_until AS "cooldownUntil", a.created_at AS "createdAt"'

/**
 * Salva a conta logada (novo login substitui a sessão). Conta de outro usuário do painel não é tomada.
 * @returns {Promise<object|null>} null se a conta já pertence a outro usuário
 */
const saveTelegramAccount = async (userId, { id, phone, label, apiId, apiHash, session }) => {
  const result = await query(
    `INSERT INTO telegram_accounts AS a (id, user_id, phone, label, api_id, api_hash, session) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, label = EXCLUDED.label, api_id = EXCLUDED.api_id,
       api_hash = EXCLUDED.api_hash, session = EXCLUDED.session
     WHERE a.user_id = EXCLUDED.user_id
     RETURNING ${ACCOUNT_COLUMNS}`,
    [id, userId, phone, label, apiId, apiHash, session]
  )
  return result.rows[0] || null
}

const deleteTelegramAccount = async (userId, accountId) => {
  const result = await query('DELETE FROM telegram_accounts WHERE user_id = $1 AND id = $2', [userId, accountId])
  return result.rowCount > 0
}

// Sessão e api_hash só saem daqui para reconectar no boot — nunca vão para o navegador
const listAllTelegramAccounts = async () => {
  const result = await query(`SELECT ${ACCOUNT_COLUMNS}, a.api_id AS "apiId", a.api_hash AS "apiHash", a.session FROM telegram_accounts a`)
  return result.rows
}

const listUserTelegramAccounts = async (userId) => {
  const result = await query(`SELECT ${ACCOUNT_COLUMNS} FROM telegram_accounts a WHERE a.user_id = $1 ORDER BY a.created_at, a.id`, [userId])
  return result.rows
}

const setAccountCooldown = async (accountId, until) => {
  await query('UPDATE telegram_accounts SET cooldown_until = $2 WHERE id = $1', [accountId, until])
}

const listOwnedAccountIds = async (userId, accountIds) => {
  const result = await query('SELECT id::text AS id FROM telegram_accounts WHERE user_id = $1 AND id = ANY($2::bigint[])', [userId, accountIds])
  return new Set(result.rows.map((row) => row.id))
}

module.exports = {
  saveTelegramAccount,
  deleteTelegramAccount,
  listAllTelegramAccounts,
  listUserTelegramAccounts,
  listOwnedAccountIds,
  setAccountCooldown
}
