const { callTelegram } = require('./telegramApi')
const { linkTelegramChat } = require('./telegramRepository')
const { normalizePhone } = require('./phone')

const MAX_CONTACT_NAME_LENGTH = 100

const ASK_PHONE_TEXT = 'Olá! Para receber nossas mensagens por aqui, toque no botão abaixo e compartilhe seu telefone.'
const LINKED_TEXT = 'Pronto! Você vai receber nossas mensagens por aqui.'
const NOT_OWN_CONTACT_TEXT = 'Compartilhe o seu próprio número pelo botão abaixo.'

const phoneKeyboard = {
  keyboard: [[{ text: 'Compartilhar meu telefone', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true
}

const askForPhone = (token, chatId, text = ASK_PHONE_TEXT) =>
  callTelegram(token, 'sendMessage', { chat_id: chatId, text, reply_markup: phoneKeyboard })

const nameOf = (contact, phone) =>
  ([contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || phone).slice(0, MAX_CONTACT_NAME_LENGTH)

// Só aceita o próprio contato: ninguém vincula o telefone de outra pessoa ao seu chat
const linkSharedContact = async (bot, message) => {
  const { contact, chat } = message
  const phone = normalizePhone(contact.phone_number)
  if (contact.user_id !== message.from?.id || !phone) return askForPhone(bot.token, chat.id, NOT_OWN_CONTACT_TEXT)
  const result = await linkTelegramChat(bot.userId, bot.id, { phone, chatId: String(chat.id), name: nameOf(contact, phone) })
  console.log(`[telegram] contato vinculado user=${bot.userId} bot=@${bot.username} telefone=****${phone.slice(-4)} resultado=${result}`)
  return callTelegram(bot.token, 'sendMessage', { chat_id: chat.id, text: LINKED_TEXT, reply_markup: { remove_keyboard: true } })
}

/**
 * Update do getUpdates. Só conversa privada: /start pede o telefone; contato compartilhado vincula.
 * @param {{ id: string, userId: string, token: string, username: string }} bot
 */
const handleTelegramUpdate = async (bot, update) => {
  const message = update.message
  if (!message || message.chat?.type !== 'private') return
  if (message.contact) return linkSharedContact(bot, message)
  if (typeof message.text === 'string' && message.text.startsWith('/start')) return askForPhone(bot.token, message.chat.id)
}

module.exports = { handleTelegramUpdate }
