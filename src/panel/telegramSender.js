const { deliverParts } = require('./broadcastRunner')
const { callTelegram, uploadTelegram } = require('./telegramApi')
const { telegramCallsOf } = require('./telegramParts')
const { findTelegramLinks } = require('./telegramRepository')
const { sendToAccountRecipient } = require('./telegramAccountSender')

const NO_TELEGRAM_ERROR = 'Contato sem Telegram vinculado a estes bots (precisa abrir o bot e compartilhar o telefone)'

const runCall = (token, chatId, { method, params, file }) => {
  const withChat = { chat_id: chatId, ...params }
  return file ? uploadTelegram(token, method, withChat, file) : callTelegram(token, method, withChat)
}

// Uma parte pode virar duas chamadas (legenda longa). Sem id: o bot não recebe tiques, não há o que casar depois.
const sendPartToChat = async (bot, chatId, part) => {
  for (const call of telegramCallsOf(part)) await runCall(bot.token, chatId, call)
  return null
}

const sendThroughBot = (bot, chatId, recipient, options, pauseBetweenParts) =>
  deliverParts(recipient, options, (part) => sendPartToChat(bot, chatId, part), pauseBetweenParts)

/**
 * Quem envia para este contato, entre as instâncias Telegram do disparo:
 * 1. bot sorteado, se o contato o abriu  2. outro bot marcado que ele abriu
 * 3. conta sorteada (envia pelo telefone)  4. outra conta marcada  → null: ninguém consegue
 * Quem já abriu um bot recebe pelo bot: poupa a conta de mensagem a desconhecido (risco de PEER_FLOOD).
 * @returns {{ instance: object, chatId?: string } | null}
 */
const pickTelegramSender = (preferred, candidates, links) => {
  const chatByBot = new Map(links.map((link) => [link.botId, link.chatId]))
  const ordered = [preferred, ...candidates.filter((candidate) => candidate !== preferred)].filter(Boolean)
  const bot = ordered.find((candidate) => candidate.kind === 'bot' && chatByBot.has(candidate.id))
  if (bot) return { instance: bot, chatId: chatByBot.get(bot.id) }
  const account = ordered.find((candidate) => candidate.kind === 'account')
  return account ? { instance: account } : null
}

/**
 * Mesma assinatura do sendToRecipient do WhatsApp: o runner troca só a entrega.
 * @param {{ sender: object, candidates: () => object[] }} client instância sorteada + instâncias conectadas do disparo
 * Telegram não informa entrega/leitura — o relatório fica em "enviado".
 */
const sendToTelegramRecipient = async (client, recipient, options, pauseBetweenParts) => {
  let links
  try {
    links = await findTelegramLinks(client.sender.userId, recipient.phone)
  } catch (error) {
    return { status: 'failed', error: `Erro ao buscar o chat do Telegram: ${error.message}`.slice(0, 255) }
  }
  const target = pickTelegramSender(client.sender, client.candidates(), links)
  if (!target) return { status: 'failed', error: NO_TELEGRAM_ERROR, noAccount: true }
  const outcome = target.instance.kind === 'bot'
    ? await sendThroughBot(target.instance, target.chatId, recipient, options, pauseBetweenParts)
    : await sendToAccountRecipient(target.instance, recipient, options, pauseBetweenParts)
  // Teto diário e rodízio contam quem realmente enviou
  return target.instance === client.sender ? outcome : { ...outcome, senderSessionId: target.instance.instanceId }
}

module.exports = { sendToTelegramRecipient, pickTelegramSender, NO_TELEGRAM_ERROR }
