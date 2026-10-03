const { sessions, validateSession } = require('../sessions')
const { getSessionStatus } = require('./panelEvents')
const { listOwnedSessionIds, botIdOfInstance, accountIdOfInstance } = require('./broadcastSessions')
const { sendToRecipient } = require('./broadcastRunner')
const { getTelegramBot } = require('./telegramBots')
const { sendToTelegramRecipient } = require('./telegramSender')
const { listOwnedBotIds, countPhonesLinkedToBots } = require('./telegramRepository')
const { getTelegramAccount, nearestCooldownEnd } = require('./telegramAccounts')
const { reportTimeZone } = require('../config')
const { listOwnedAccountIds } = require('./telegramAccountRepository')

const WHATSAPP = 'whatsapp'
const TELEGRAM = 'telegram'

// Só usa instância realmente conectada (evita tentar enviar em sessão no QR / desconectada)
const getConnectedClient = (sessionId) => {
  if (getSessionStatus(sessionId) !== 'connected') return null
  return sessions.get(sessionId) || null
}

const countConnected = async (sessionIds) => {
  let connected = 0
  for (const sessionId of sessionIds) {
    if ((await validateSession(sessionId)).success) connected += 1
  }
  return connected
}

/**
 * @param {'all-connected' | 'any-connected' | 'ownership-only'} mode
 * all-connected: cada número escolhido está online
 * any-connected: envio agora e retomar — segue com quem estiver online; desconectada fica no rodízio e entra quando voltar
 * ownership-only: programar ou trocar instâncias — a conexão é checada na hora de enviar
 */
const findSessionsBlocker = async (userId, sessionIds, mode) => {
  if (sessionIds.length === 0) return [422, 'Escolha ao menos uma instância']
  const owned = await listOwnedSessionIds(userId, sessionIds)
  if (sessionIds.some((sessionId) => !owned.has(sessionId))) return [403, 'Uma das instâncias não pertence a você']
  if (mode === 'ownership-only') return null
  const connected = await countConnected(sessionIds)
  if (mode === 'all-connected' && connected < sessionIds.length) return [409, 'Todas as instâncias selecionadas precisam estar conectadas']
  if (connected === 0) return [409, 'Nenhuma das instâncias selecionadas está conectada']
  return null
}

// Instância Telegram no ar: bot com polling ativo ou conta com sessão autorizada
const runningTelegram = (userId, instanceIds) =>
  instanceIds.map((instanceId) => getTelegramBot(instanceId, userId) || getTelegramAccount(instanceId, userId)).filter(Boolean)

const isOwnedTelegram = async (userId, instanceIds) => {
  const botIds = instanceIds.map(botIdOfInstance).filter(Boolean)
  const accountIds = instanceIds.map(accountIdOfInstance).filter(Boolean)
  const [ownedBots, ownedAccounts] = await Promise.all([listOwnedBotIds(userId, botIds), listOwnedAccountIds(userId, accountIds)])
  return botIds.every((id) => ownedBots.has(id)) && accountIds.every((id) => ownedAccounts.has(id))
}

// Mesmos modos do WhatsApp, com bots e contas do Telegram
const findTelegramBlocker = async (userId, instanceIds, mode) => {
  if (instanceIds.length === 0) return [422, 'Escolha ao menos uma instância do Telegram']
  if (instanceIds.some((id) => !botIdOfInstance(id) && !accountIdOfInstance(id))) return [422, 'Disparo pelo Telegram só usa instâncias do Telegram']
  if (!(await isOwnedTelegram(userId, instanceIds))) return [403, 'Uma das instâncias não pertence a você']
  if (mode === 'ownership-only') return null
  const running = runningTelegram(userId, instanceIds).length
  if (mode === 'all-connected' && running < instanceIds.length) return [409, 'Todas as instâncias selecionadas precisam estar conectadas']
  if (running === 0) return [409, 'Nenhuma das instâncias do Telegram selecionadas está conectada']
  return null
}

// Só bots marcados (sem conta) e ninguém da lista abriu esses bots: todos falhariam. Recusa antes de começar.
const findTelegramAudienceBlocker = async (userId, instanceIds, recipients) => {
  if (instanceIds.some(accountIdOfInstance)) return null
  const botIds = instanceIds.map(botIdOfInstance).filter(Boolean)
  const linked = await countPhonesLinkedToBots(userId, botIds, recipients.map((recipient) => recipient.phone))
  if (linked > 0) return null
  return [422, 'Ninguém desta lista abriu os bots marcados, então todos falhariam. Mande o link do bot para os contatos ou marque uma instância “TG conta” (envia pelo telefone).']
}

const formatClock = (date) => date.toLocaleString('pt-BR', { timeZone: reportTimeZone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Ninguém do Telegram pode enviar e há conta em pausa por limite: pausa que o agendador retoma quando acabar
const explainTelegramUnavailable = (userId, instanceIds) => {
  if (runningTelegram(userId, instanceIds).length > 0) return null
  const end = nearestCooldownEnd(instanceIds, userId)
  if (!end) return null
  return { code: 'cooldown', error: `Pausado: conta do Telegram limitada pelo Telegram até ${formatClock(end)}. Retoma sozinho depois desse horário.` }
}

/**
 * Canal do disparo. O runner é o mesmo; muda quem envia e como checar se dá para enviar.
 * clientGetter recebe os ids ao vivo do disparo (a troca de instâncias muda a mesma lista).
 */
const whatsappChannel = {
  name: WHATSAPP,
  notReadyReason: 'Instâncias desconectadas',
  findBlocker: findSessionsBlocker,
  findAudienceBlocker: async () => null,
  unavailableExplainer: () => null,
  clientGetter: () => getConnectedClient,
  deliver: sendToRecipient,
  isReady: async (_userId, sessionIds, { all = false } = {}) => {
    const connected = await countConnected(sessionIds)
    return all ? sessionIds.length > 0 && connected === sessionIds.length : connected > 0
  }
}

const telegramChannel = {
  name: TELEGRAM,
  notReadyReason: 'Instâncias do Telegram desconectadas',
  findBlocker: findTelegramBlocker,
  findAudienceBlocker: findTelegramAudienceBlocker,
  unavailableExplainer: (userId) => (instanceIds) => explainTelegramUnavailable(userId, instanceIds),
  clientGetter: (userId, instanceIds) => (instanceId) => {
    const sender = getTelegramBot(instanceId, userId) || getTelegramAccount(instanceId, userId)
    return sender ? { sender, candidates: () => runningTelegram(userId, instanceIds) } : null
  },
  deliver: sendToTelegramRecipient,
  isReady: async (userId, instanceIds, { all = false } = {}) => {
    const running = runningTelegram(userId, instanceIds).length
    return all ? instanceIds.length > 0 && running === instanceIds.length : running > 0
  }
}

// Disparos anteriores ao Telegram não têm canal: WhatsApp
const channelNamed = (name) => (name === TELEGRAM ? telegramChannel : whatsappChannel)

const parseChannel = (value) => {
  if (value === undefined || value === null || value === WHATSAPP) return { channel: WHATSAPP }
  if (value === TELEGRAM) return { channel: TELEGRAM }
  return { error: 'Canal inválido: use whatsapp ou telegram' }
}

module.exports = { channelNamed, parseChannel, getConnectedClient, WHATSAPP, TELEGRAM }
