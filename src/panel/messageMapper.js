const STATUS_BROADCAST_ID = 'status@broadcast'

// Mensagem enviada por nós vai para `to`; recebida vem de `from`. Em grupos ambos apontam para o id do grupo.
const resolveChatId = (message) => (message.fromMe ? message.to : message.from)

const isStatusBroadcast = (message) => resolveChatId(message) === STATUS_BROADCAST_ID

// Eventos de sistema que o WhatsApp entrega como "mensagem" mas não são conversa
// (código de segurança mudou, avisos de grupo, chamadas, mensagens ainda cifradas)
const SYSTEM_MESSAGE_TYPES = new Set([
  'e2e_notification', 'notification', 'notification_template', 'gp2', 'protocol', 'call_log', 'ciphertext'
])

const isRecordableMessage = (message) => !isStatusBroadcast(message) && !SYSTEM_MESSAGE_TYPES.has(message.type)

const serializeWid = (wid) => {
  if (!wid || typeof wid === 'string') return wid || null
  return wid._serialized || (wid.user && wid.server ? `${wid.user}@${wid.server}` : null)
}

/**
 * Id único da mensagem ("true_5511...@c.us_3EB0..."). No WhatsApp Web atual o `_serialized`
 * é getter e se perde ao sair do navegador — então remonta a partir das partes.
 */
const serializeMessageId = (message) => {
  const id = message.id || message._data?.id
  if (!id) return null
  if (typeof id === 'string') return id
  if (id._serialized) return id._serialized
  const remote = serializeWid(id.remote)
  if (!remote || !id.id) return null
  const participant = serializeWid(id.participant)
  return [String(Boolean(id.fromMe)), remote, id.id, participant].filter(Boolean).join('_')
}

/**
 * Chave estável da mensagem (ex.: "3EB0DB4BD378834E54BE1F"). O WhatsApp Web serializa a mesma
 * mensagem ora com o LID (`true_<lid>@lid_KEY`), ora com o telefone (`true_<tel>@c.us_KEY`);
 * só a chave é igual nos dois — é por ela que os tiques (entregue/lido) são casados.
 */
const messageKeyOf = (message) => {
  const id = message?.id || message?._data?.id
  if (!id) return null
  if (typeof id === 'string') return messageKeyFromId(id)
  return id.id || messageKeyFromId(id._serialized)
}

// "true_5511...@c.us_3EB0..._participante" → "3EB0..."
const messageKeyFromId = (serializedId) => (serializedId ? serializedId.split('_')[2] || null : null)

/**
 * Converte uma Message do whatsapp-web.js no registro da tabela whatsapp_messages.
 * Mídia: guarda só metadados — o arquivo continua no WhatsApp.
 * `chatId` permite gravar o id canônico (telefone) no lugar do LID.
 */
const toMessageRecord = (sessionId, message, { chatName = null, chatId = resolveChatId(message) } = {}) => {
  const data = message._data || {}
  return {
    sessionId,
    messageId: serializeMessageId(message),
    chatId,
    chatName,
    fromMe: Boolean(message.fromMe),
    author: message.author || null,
    senderName: message.fromMe ? null : (data.notifyName || null),
    type: message.type,
    body: message.body || null,
    hasMedia: Boolean(message.hasMedia),
    mediaMimetype: message.hasMedia ? (data.mimetype || null) : null,
    mediaFilename: message.hasMedia ? (data.filename || null) : null,
    sentAt: new Date(message.timestamp * 1000)
  }
}

module.exports = {
  toMessageRecord,
  isStatusBroadcast,
  isRecordableMessage,
  SYSTEM_MESSAGE_TYPES,
  resolveChatId,
  serializeMessageId,
  serializeWid,
  messageKeyOf,
  messageKeyFromId
}
