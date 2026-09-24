const { Message } = require('whatsapp-web.js')
const { toMessageRecord, isRecordableMessage } = require('./messageMapper')
const { saveMessage } = require('./messageRepository')
const { publishPanelEvent } = require('./panelEvents')

// ponytail: janela fixa (30 chats × 30 msgs já carregadas pelo WhatsApp Web) — suficiente para o painel
// abrir com as conversas vivas. Histórico mais antigo exigiria loadEarlierMsgs por chat.
const BACKFILL_CHAT_LIMIT = 30
const BACKFILL_MESSAGES_PER_CHAT = 30
// Dá tempo do WhatsApp Web popular o Store de chats depois do `ready`
const INITIAL_SYNC_DELAY_MS = 5000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Lê chats e mensagens direto do Store da página. Não usa client.getChats(): no WhatsApp Web atual
 * o getChatModel do wwebjs 1.34.7 lança erro minificado ("r"). getMessageModel continua íntegro
 * (é o mesmo usado pelo evento message_create). Roda dentro do navegador — sem closures externas.
 */
/* global window */
const readRecentChatsInPage = (chatLimit, messageLimit) => {
  const { Chat } = window.require('WAWebCollections')
  return Chat.getModelsArray()
    .filter((chat) => chat.id && chat.id._serialized !== 'status@broadcast')
    .sort((a, b) => (b.t || 0) - (a.t || 0))
    .slice(0, chatLimit)
    .map((chat) => {
      let messages = []
      try {
        messages = chat.msgs.getModelsArray().slice(-messageLimit).map((msg) => window.WWebJS.getMessageModel(msg))
      } catch (error) {
        messages = []
      }
      return { chatId: chat.id._serialized, chatName: chat.formattedTitle || chat.name || null, messages }
    })
}

// Retorna quantas mensagens eram novas; ON CONFLICT ignora as já salvas (roda a cada reconexão)
const importChat = async (sessionId, client, chat, resolveCanonicalChatId) => {
  const chatId = await resolveCanonicalChatId(chat.chatId)
  let inserted = 0
  for (const data of chat.messages) {
    const message = new Message(client, data)
    if (!isRecordableMessage(message)) continue
    const record = toMessageRecord(sessionId, message, { chatName: chat.chatName, chatId })
    if (record.messageId && await saveMessage(record)) inserted++
  }
  return inserted
}

/**
 * Importa as conversas recentes do WhatsApp para o banco do painel.
 */
const backfillRecentHistory = async (sessionId, client, resolveCanonicalChatId) => {
  const startedAt = Date.now()
  console.log(`[panel] importando histórico recente sessão=${sessionId}`)
  try {
    await wait(INITIAL_SYNC_DELAY_MS)
    const chats = await client.pupPage.evaluate(readRecentChatsInPage, BACKFILL_CHAT_LIMIT, BACKFILL_MESSAGES_PER_CHAT)
    let inserted = 0
    let failedChats = 0
    for (const chat of chats) {
      try {
        inserted += await importChat(sessionId, client, chat, resolveCanonicalChatId)
      } catch (error) {
        failedChats++
        console.warn(`[panel] falha ao importar chat sessão=${sessionId} chat=${chat.chatId}:`, error.stack || error.message)
      }
    }
    console.log(`[panel] histórico importado sessão=${sessionId} chats=${chats.length} novas=${inserted} falhas=${failedChats} em ${Date.now() - startedAt}ms`)
    publishPanelEvent({ type: 'history_synced', sessionId, inserted })
  } catch (error) {
    console.error(`[panel] falha ao importar histórico sessão=${sessionId}:`, error.stack || error.message)
  }
}

module.exports = { backfillRecentHistory }
