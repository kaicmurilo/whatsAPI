const { setTimeout: sleep } = require('timers/promises')
const { callTelegram } = require('./telegramApi')
const { handleTelegramUpdate } = require('./telegramLinker')
const { saveTelegramBot, deleteTelegramBot, listAllTelegramBots, listUserTelegramBots } = require('./telegramRepository')
const { telegramInstanceId } = require('./broadcastSessions')

const POLL_TIMEOUT_SECONDS = 30
const RETRY_DELAY_MS = 5000
const UNAUTHORIZED = 401

// ponytail: bots e long polling em memória, por instância — vale para uma réplica (igual ao runner); com várias, só uma pode fazer getUpdates
const bots = new Map()

const pollUpdates = async (bot) => {
  const { signal } = bot.controller
  let offset = 0
  while (!signal.aborted) {
    try {
      const updates = await callTelegram(bot.token, 'getUpdates', { offset, timeout: POLL_TIMEOUT_SECONDS, allowed_updates: ['message'] }, { signal })
      for (const update of updates) {
        offset = update.update_id + 1
        await handleTelegramUpdate(bot, update)
          .catch((error) => console.warn(`[telegram] falha ao tratar mensagem bot=@${bot.username} user=${bot.userId}: ${error.message}`))
      }
    } catch (error) {
      if (signal.aborted) return
      if (error.code === UNAUTHORIZED) {
        console.error(`[telegram] token recusado, bot parado bot=@${bot.username} user=${bot.userId}`)
        if (bots.get(bot.instanceId) === bot) bots.delete(bot.instanceId)
        return
      }
      console.warn(`[telegram] falha no getUpdates bot=@${bot.username} user=${bot.userId}: ${error.message}`)
      await sleep(RETRY_DELAY_MS, undefined, { signal }).catch(() => {})
    }
  }
}

const stopBot = (instanceId) => {
  bots.get(instanceId)?.controller.abort()
  bots.delete(instanceId)
}

const startBot = ({ id, userId, token, username }) => {
  const instanceId = telegramInstanceId(id)
  stopBot(instanceId)
  const bot = { kind: 'bot', id: String(id), instanceId, userId, token, username, controller: new AbortController() }
  bots.set(instanceId, bot)
  pollUpdates(bot).catch((error) => console.error(`[telegram] polling encerrado bot=@${username}:`, error))
  return bot
}

/**
 * Valida o token (getMe), tira webhook antigo (impede o getUpdates), salva e liga o bot como instância.
 * @returns {Promise<{ bot?: object, error?: 'owned_by_other' }>}
 */
const connectTelegramBot = async (userId, token) => {
  const me = await callTelegram(token, 'getMe')
  const saved = await saveTelegramBot(userId, { id: me.id, username: me.username, token })
  if (!saved) return { error: 'owned_by_other' }
  await callTelegram(token, 'deleteWebhook')
  startBot({ id: me.id, userId, token, username: me.username })
  console.log(`[telegram] bot conectado bot=@${me.username} instância=${telegramInstanceId(me.id)} user=${userId}`)
  return { bot: saved }
}

const removeTelegramBot = async (userId, botId) => {
  const deleted = await deleteTelegramBot(userId, botId)
  if (deleted) {
    stopBot(telegramInstanceId(botId))
    console.log(`[telegram] bot removido instância=${telegramInstanceId(botId)} user=${userId}`)
  }
  return deleted
}

const startTelegramBots = async () => {
  const saved = await listAllTelegramBots()
  saved.forEach(startBot)
  if (saved.length > 0) console.log(`[telegram] ${saved.length} bot(s) ligado(s)`)
}

// Só devolve o bot ao dono: ids de instância vêm do navegador e do histórico
const getTelegramBot = (instanceId, userId) => {
  const bot = bots.get(instanceId)
  return bot && bot.userId === userId ? bot : null
}

// Bots do usuário no formato de instância (o seletor de instâncias do painel serve aos dois canais)
const listTelegramInstances = async (userId) => {
  const saved = await listUserTelegramBots(userId)
  return saved.map((bot) => {
    const instanceId = telegramInstanceId(bot.id)
    return {
      kind: 'bot',
      sessionId: instanceId,
      label: `@${bot.username}`,
      username: bot.username,
      status: getTelegramBot(instanceId, userId) ? 'connected' : 'disconnected',
      phone: null,
      pushName: null,
      linkedContacts: bot.linkedContacts,
      createdAt: bot.createdAt
    }
  })
}

module.exports = { connectTelegramBot, removeTelegramBot, startTelegramBots, getTelegramBot, listTelegramInstances }
