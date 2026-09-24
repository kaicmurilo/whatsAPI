const { toMessageRecord, isRecordableMessage, resolveChatId } = require('./messageMapper')
const { saveMessage } = require('./messageRepository')
const { publishPanelEvent, setSessionStatus } = require('./panelEvents')
const { backfillRecentHistory } = require('./historyBackfill')
const { createChatIdResolver } = require('./chatIdResolver')
const { attachDeliveryTracker } = require('./deliveryTracker')

// getChat() falha para chats @lid no WhatsApp Web atual; o nome cai no último remetente conhecido (SQL)
const fetchChatName = async (sessionId, message) => {
  try {
    const chat = await message.getChat()
    return chat.name || null
  } catch (error) {
    console.warn(`[panel] nome do chat indisponível sessão=${sessionId} chat=${resolveChatId(message)}:`, error.message)
    return null
  }
}

const recordMessage = async (sessionId, message, resolveCanonicalChatId) => {
  if (!isRecordableMessage(message)) return
  try {
    const [chatName, chatId] = await Promise.all([
      fetchChatName(sessionId, message),
      resolveCanonicalChatId(resolveChatId(message))
    ])
    const record = toMessageRecord(sessionId, message, { chatName, chatId })
    if (!record.messageId) {
      console.warn(`[panel] mensagem sem id ignorada sessão=${sessionId} chat=${chatId}`)
      return
    }
    const saved = await saveMessage(record)
    if (saved) publishPanelEvent({ type: 'message', sessionId, message: saved })
  } catch (error) {
    console.error(`[panel] falha ao salvar mensagem sessão=${sessionId}:`, error.message)
  }
}

/**
 * Liga persistência de mensagens e status da instância a um client.
 * Independe de DISABLED_CALLBACKS: desligar o webhook não pode desligar o histórico.
 */
const attachSessionRecorder = (client, sessionId) => {
  const resolveCanonicalChatId = createChatIdResolver(client, sessionId)
  setSessionStatus(sessionId, 'starting')
  client.on('qr', () => setSessionStatus(sessionId, 'qr'))
  client.on('authenticated', () => setSessionStatus(sessionId, 'authenticated'))
  client.on('ready', () => {
    setSessionStatus(sessionId, 'connected')
    backfillRecentHistory(sessionId, client, resolveCanonicalChatId) // fire-and-forget; loga o próprio resultado
  })
  client.on('auth_failure', () => setSessionStatus(sessionId, 'auth_failure'))
  client.on('disconnected', () => setSessionStatus(sessionId, 'disconnected'))
  // message_create cobre recebidas e enviadas (inclusive pelo celular)
  client.on('message_create', (message) => recordMessage(sessionId, message, resolveCanonicalChatId))
  // Tiques de entrega/leitura das transmissões (relatório)
  attachDeliveryTracker(client, sessionId, resolveCanonicalChatId)
}

module.exports = { attachSessionRecorder }
