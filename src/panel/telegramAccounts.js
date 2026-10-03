const { TelegramClient, Api } = require('telegram')
const { StringSession } = require('telegram/sessions')
const { saveTelegramAccount, deleteTelegramAccount, listAllTelegramAccounts, listUserTelegramAccounts, setAccountCooldown } = require('./telegramAccountRepository')
const { accountInstanceId } = require('./broadcastSessions')

const CONNECTION_RETRIES = 5

// ponytail: contas conectadas em memória (uma réplica, igual aos bots e ao runner)
const accounts = new Map()

const maskPhone = (phone) => `****${String(phone).slice(-4)}`

const createTelegramClient = (session, apiId, apiHash) => {
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: CONNECTION_RETRIES })
  client.setLogLevel('error')
  return client
}

const registerAccount = ({ id, userId, label, phone, cooldownUntil = null }, client) => {
  const instanceId = accountInstanceId(id)
  accounts.set(instanceId, { kind: 'account', id: String(id), instanceId, userId, label, phone, client, cooldownUntil: cooldownUntil ? new Date(cooldownUntil) : null })
  return instanceId
}

const isCoolingDown = (account, now = Date.now()) => Boolean(account.cooldownUntil && account.cooldownUntil.getTime() > now)

/**
 * Telegram limitou a conta: tira do rodízio de todos os disparos até `ms` passar (fica no banco, sobrevive a reinício).
 * Disparos que só têm esta conta pausam no próximo contato ("nenhuma instância conectada") e são retomados à mão.
 */
const coolDownTelegramAccount = async (account, ms, reason) => {
  const until = new Date(Date.now() + ms)
  if (account.cooldownUntil && account.cooldownUntil >= until) return
  account.cooldownUntil = until
  console.warn(`[telegram] conta em pausa pelo limite do Telegram conta=${account.label} até=${until.toISOString()} motivo=${reason}`)
  await setAccountCooldown(account.id, until).catch((error) => console.error(`[telegram] falha ao gravar pausa da conta=${account.label}: ${error.message}`))
}

// Boot: reconecta com a sessão salva. Sessão encerrada no celular (dispositivos) fica desconectada até logar de novo.
const startAccount = async (row) => {
  const client = createTelegramClient(row.session, row.apiId, row.apiHash)
  try {
    await client.connect()
    if (!(await client.checkAuthorization())) {
      console.warn(`[telegram] sessão da conta encerrada conta=${row.label} telefone=${maskPhone(row.phone)} user=${row.userId}`)
      await client.disconnect()
      return
    }
    registerAccount(row, client)
  } catch (error) {
    console.error(`[telegram] falha ao conectar conta=${row.label} user=${row.userId}: ${error.message}`)
    await client.disconnect().catch(() => {})
  }
}

const startTelegramAccounts = async () => {
  const saved = await listAllTelegramAccounts()
  await Promise.all(saved.map(startAccount))
  if (saved.length > 0) console.log(`[telegram] ${accounts.size}/${saved.length} conta(s) conectada(s)`)
}

/**
 * Login concluído: salva a sessão e coloca a conta no ar como instância.
 * @returns {Promise<{ instanceId?: string, error?: 'owned_by_other' }>}
 */
const saveLoggedAccount = async (userId, client, { apiId, apiHash }) => {
  const me = await client.getMe()
  const label = (me.username ? `@${me.username}` : [me.firstName, me.lastName].filter(Boolean).join(' ')) || `+${me.phone}`
  const row = { id: me.id.toString(), userId, phone: String(me.phone || ''), label: label.slice(0, 100) }
  const saved = await saveTelegramAccount(userId, { ...row, apiId, apiHash, session: client.session.save() })
  if (!saved) return { error: 'owned_by_other' }
  accounts.get(accountInstanceId(row.id))?.client.disconnect().catch(() => {})
  const instanceId = registerAccount(row, client)
  console.log(`[telegram] conta conectada conta=${row.label} instância=${instanceId} telefone=${maskPhone(row.phone)} user=${userId}`)
  return { instanceId }
}

// Remove do painel e encerra a sessão no Telegram (some de "Dispositivos" no celular)
const removeTelegramAccount = async (userId, accountId) => {
  const deleted = await deleteTelegramAccount(userId, accountId)
  if (!deleted) return false
  const instanceId = accountInstanceId(accountId)
  const account = accounts.get(instanceId)
  accounts.delete(instanceId)
  if (account) {
    await account.client.invoke(new Api.auth.LogOut()).catch((error) => console.warn(`[telegram] logout falhou conta=${account.label}: ${error.message}`))
    await account.client.disconnect().catch(() => {})
  }
  console.log(`[telegram] conta removida instância=${instanceId} user=${userId}`)
  return true
}

// Só devolve a conta ao dono (ids vêm do navegador e do histórico) e fora da pausa por limite
const getTelegramAccount = (instanceId, userId) => {
  const account = accounts.get(instanceId)
  return account && account.userId === userId && !isCoolingDown(account) ? account : null
}

// Fim da pausa mais próxima entre as contas do usuário nestes ids (null = nenhuma em pausa)
const nearestCooldownEnd = (instanceIds, userId) => {
  const ends = instanceIds
    .map((instanceId) => accounts.get(instanceId))
    .filter((account) => account && account.userId === userId && isCoolingDown(account))
    .map((account) => account.cooldownUntil.getTime())
  return ends.length > 0 ? new Date(Math.min(...ends)) : null
}

const listAccountInstances = async (userId) => {
  const saved = await listUserTelegramAccounts(userId)
  return saved.map((account) => {
    const instanceId = accountInstanceId(account.id)
    const cooling = account.cooldownUntil && new Date(account.cooldownUntil).getTime() > Date.now()
    return {
      kind: 'account',
      sessionId: instanceId,
      label: account.label,
      status: getTelegramAccount(instanceId, userId) ? 'connected' : 'disconnected',
      cooldownUntil: cooling ? account.cooldownUntil : null,
      phone: account.phone || null,
      pushName: null,
      linkedContacts: null,
      createdAt: account.createdAt
    }
  })
}

module.exports = {
  createTelegramClient, saveLoggedAccount, removeTelegramAccount, startTelegramAccounts, getTelegramAccount, listAccountInstances, coolDownTelegramAccount, nearestCooldownEnd
}
