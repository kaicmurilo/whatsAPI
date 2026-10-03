const { toMessageRecord, isRecordableMessage, resolveChatId } = require('./messageMapper')
const { saveMessage } = require('./messageRepository')
const { pickChatTitle, readChatTitleCandidatesInPage } = require('./chatTitle')
const { noteSuppressionKeyword } = require('./suppressionRepository')
const { publishPanelEvent, setSessionStatus } = require('./panelEvents')
const { backfillRecentHistory } = require('./historyBackfill')
const { createChatIdResolver } = require('./chatIdResolver')
const { attachDeliveryTracker } = require('./deliveryTracker')
const { reconcileRecentRuns } = require('./deliveryReconciler')

// getChat() passa por getChatModel, que no WhatsApp Web atual quebra em grupo.
// O título é lido direto do Store (formattedTitle / assunto). Sem título, a lista
// usa o último remetente só em conversa 1:1 — grupo não herda nome de participante.
const fetchChatName = async (sessionId, message) => {
  const chatId = resolveChatId(message)
  const page = message.client?.pupPage
  if (!page) return null
  try {
    const candidates = await page.evaluate(readChatTitleCandidatesInPage, chatId)
    return pickChatTitle(chatId, ...(Array.isArray(candidates) ? candidates : []))
  } catch (error) {
    console.warn(`[panel] nome do chat indisponível sessão=${sessionId} chat=${chatId}:`, error.message)
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
    if (saved) {
      publishPanelEvent({ type: 'message', sessionId, message: saved })
      noteSuppressionKeyword(sessionId, saved).catch((error) => {
        console.error(`[panel] falha ao registrar supressão sessão=${sessionId}:`, error.message)
      })
    }
  } catch (error) {
    console.error(`[panel] falha ao salvar mensagem sessão=${sessionId}:`, error.message)
  }
}

// A lib emite ready em qualquer mudança de hasSynced, inclusive quando volta a false.
// Se a página não responder, confia na lib: melhor um ready falso do que perder uma conexão real.
const hasSynced = async (client) => {
  try {
    return await client.pupPage.evaluate(() => window.require('WAWebSocketModel').Socket.hasSynced === true)
  } catch {
    return true
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
  client.on('ready', async () => {
    // Depois de LOGOUT a página volta ao QR e a lib emite ready de novo: não é conexão
    if (!(await hasSynced(client))) {
      console.warn(`[session] ready ignorado sessão=${sessionId}: WhatsApp não está sincronizado (provável LOGOUT)`)
      return
    }
    setSessionStatus(sessionId, 'connected')
    // fire-and-forget em sequência (mesmo navegador): conversas recentes, depois tiques perdidos das transmissões
    backfillRecentHistory(sessionId, client, resolveCanonicalChatId)
      .then(() => reconcileRecentRuns(sessionId, client))
  })
  client.on('auth_failure', () => setSessionStatus(sessionId, 'auth_failure'))
  // Motivo vem do WhatsApp (ex.: LOGOUT = aparelho desvinculado/banido, CONFLICT = aberto em outro lugar)
  client.on('disconnected', (reason) => {
    console.warn(`[session] desconectada sessão=${sessionId} motivo=${reason}`)
    setSessionStatus(sessionId, 'disconnected')
  })
  // message_create cobre recebidas e enviadas (inclusive pelo celular)
  client.on('message_create', (message) => recordMessage(sessionId, message, resolveCanonicalChatId))
  // Tiques de entrega/leitura das transmissões (relatório)
  attachDeliveryTracker(client, sessionId, resolveCanonicalChatId)
}

module.exports = { attachSessionRecorder }
