const { sessions } = require('../sessions')
const { sendErrorResponse } = require('../utils')
const { normalizePhone } = require('./phone')
const { CHAT_ID_PATTERN, parseId } = require('./validators')
const { serializeMessageId, serializeWid } = require('./messageMapper')
const { loadOwnedMedia } = require('./mediaLoader')

const MAX_TEXT_LENGTH = 4096

// Texto e/ou arquivo da biblioteca; com arquivo, o texto vira legenda
const parseOutgoing = (body) => {
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const hasFile = body?.fileId !== undefined && body.fileId !== null
  const fileId = hasFile ? parseId(String(body.fileId)) : null
  if (hasFile && fileId === null) return { error: 'Arquivo inválido' }
  if (text.length > MAX_TEXT_LENGTH) return { error: `Mensagem maior que ${MAX_TEXT_LENGTH} caracteres` }
  if (!text && fileId === null) return { error: 'Mensagem vazia' }
  return { outgoing: { text, fileId } }
}

const buildContent = async (userId, { text, fileId }) => {
  if (fileId === null) return { content: text, options: {} }
  const loaded = await loadOwnedMedia(userId, fileId)
  if (!loaded) return null
  return { content: loaded.media, options: text ? { ...loaded.sendOptions, caption: text } : loaded.sendOptions }
}

// Não grava nada aqui: a mensagem enviada dispara message_create, que já persiste e publica no SSE
const sendMessage = async (req, res) => {
  const { sessionId, chatId } = req.params
  const userId = req.user.user_id
  if (!CHAT_ID_PATTERN.test(chatId)) return sendErrorResponse(res, 422, 'Chat inválido')
  const { outgoing, error } = parseOutgoing(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const built = await buildContent(userId, outgoing)
    if (!built) return sendErrorResponse(res, 404, 'Arquivo não encontrado')
    const sent = await sessions.get(sessionId).sendMessage(chatId, built.content, built.options)
    // Com chats @lid o wwebjs 1.34 envia mas às vezes não acha o modelo da mensagem e devolve undefined:
    // a mensagem saiu (chega no celular e volta pelo message_create), só não temos o id aqui.
    const messageId = sent ? serializeMessageId(sent) : null
    console.log(`[panel] mensagem enviada sessão=${sessionId} chat=${chatId} arquivo=${outgoing.fileId ?? '-'} id=${messageId ?? 'sem-confirmação'} user=${userId}`)
    res.status(201).json({ success: true, data: { messageId } })
  } catch (sendError) {
    console.error(`[panel] falha ao enviar mensagem sessão=${sessionId} chat=${chatId}:`, sendError.message)
    sendErrorResponse(res, 502, 'O WhatsApp não aceitou a mensagem')
  }
}

// Confirma que o número tem WhatsApp e devolve o id canônico (pode diferir no 9º dígito BR)
const resolveNumber = async (req, res) => {
  const { sessionId } = req.params
  const phone = normalizePhone(req.params.phone)
  if (!phone) return sendErrorResponse(res, 422, 'Telefone inválido')
  try {
    const numberId = await sessions.get(sessionId).getNumberId(phone)
    const chatId = serializeWid(numberId)
    if (!chatId) return sendErrorResponse(res, 404, 'Este número não tem WhatsApp')
    res.json({ success: true, data: { chatId } })
  } catch (error) {
    console.error(`[panel] falha ao resolver número sessão=${sessionId}:`, error.message)
    sendErrorResponse(res, 502, 'Não foi possível consultar o WhatsApp')
  }
}

module.exports = { sendMessage, resolveNumber }
