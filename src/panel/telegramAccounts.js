const { TelegramClient, Api } = require('telegram')
const { StringSession } = require('telegram/sessions')
const { saveTelegramAccount, deleteTelegramAccount, listAllTelegramAccounts, listUserTelegramAccounts, setAccountCooldown } = require('./telegramAccountRepository')
const { accountInstanceId } = require('./broadcastSessions')
const { nextCooldown } = require('./telegramCooldown')

const CONNECTION_RETRIES = 5

// ponytail: contas conectadas em memória (uma réplica, igual aos bots e ao runner)
const accounts = new Map()

const maskPhone = (phone) => `****${String(phone).slice(-4)}`

const createTelegramClient = (session, apiId, apiHash) => {
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: CONNECTION_RETRIES })
  client.setLogLevel('error')
  return client
}

const registerAccount = ({ id, userId, label, phone, cooldownUntil = null, cooldownStrikes = 0 }, client) => {
  const instanceId = accountInstanceId(id)
  accounts.set(instanceId, {
    kind: 'account',
    id: String(id),
    instanceId,
    userId,
    label,
    phone,
    client,
    cooldownUntil: cooldownUntil ? new Date(cooldownUntil) : null,
    cooldownStrikes
  })
  return instanceId
}

const persistCooldown = (account) =>
  setAccountCooldown(account.id, { until: account.cooldownUntil, strikes: account.cooldownStrikes })
    .catch((error) => console.error(`[telegram] falha ao gravar pausa da conta=${account.label}: ${error.message}`))

const isCoolingDown = (account, now = Date.now()) => Boolean(account.cooldownUntil && account.cooldownUntil.getTime() > now)

/**
 * Telegram limitou a conta: tira do rodízio de todos os disparos até a próxima tentativa (no banco, sobrevive a reinício).
 * Espera crescente (telegramCooldown). Quando acaba, o agendador retoma os disparos e a 1ª busca testa se liberou.
 * @param {{ policy?: string, fixedMs?: number }} cooldown
 */
const coolDownTelegramAccount = async (account, cooldown, reason) => {
  // Outro disparo já pôs em pausa neste mesmo limite: não conta strike de novo
  if (isCoolingDown(account)) return
  const { ms, strikes } = nextCooldown(account.cooldownStrikes, cooldown)
  account.cooldownUntil = new Date(Date.now() + ms)
  account.cooldownStrikes = strikes
  console.warn(`[telegram] conta em pausa pelo limite do Telegram conta=${account.label} próxima tentativa=${account.cooldownUntil.toISOString()} limites seguidos=${strikes} motivo=${reason}`)
  await persistCooldown(account)
}

// Envio com sucesso: a conta voltou, a próxima pausa recomeça da espera mínima
const resetTelegramAccountStrikes = async (account) => {
  if (account.cooldownStrikes === 0) return
  console.log(`[telegram] conta liberada pelo Telegram conta=${account.label} depois de ${account.cooldownStrikes} limite(s)`)
  account.cooldownStrikes = 0
  account.cooldownUntil = null
  await persistCooldown(account)
}

/**
 * "Tentar agora": tira a pausa (mantém os strikes — se ainda estiver limitada, a próxima espera é maior).
 * O agendador retoma os disparos pausados por limite em até 30 s; a 1ª busca testa.
 * @returns {Promise<'retrying' | 'not_found' | 'not_cooling'>}
 */
const retryTelegramAccountNow = async (userId, accountId) => {
  const account = accounts.get(accountInstanceId(accountId))
  if (!account || account.userId !== userId) return 'not_found'
  if (!isCoolingDown(account)) return 'not_cooling'
  account.cooldownUntil = null
  console.log(`[telegram] nova tentativa pedida pelo usuário conta=${account.label} user=${userId}`)
  await persistCooldown(account)
  return 'retrying'
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
      cooldownStrikes: account.cooldownStrikes,
      phone: account.phone || null,
      pushName: null,
      linkedContacts: null,
      createdAt: account.createdAt
    }
  })
}

module.exports = {
  createTelegramClient,
  saveLoggedAccount,
  removeTelegramAccount,
  startTelegramAccounts,
  getTelegramAccount,
  listAccountInstances,
  coolDownTelegramAccount,
  nearestCooldownEnd,
  resetTelegramAccountStrikes,
  retryTelegramAccountNow
}
