const { recordDeliveryAck } = require('./deliveryRepository')
const { resolveChatId, serializeMessageId } = require('./messageMapper')
const { phoneFromChatId, alternatePhone } = require('./phone')
const { publishPanelEvent } = require('./panelEvents')

const ACK_DELIVERED = 2

// Telefone do chat (canônico, sem LID) + variante do 9º dígito: o contato pode estar salvo de qualquer jeito
const phonesForChat = (chatId) => {
  const phone = phoneFromChatId(chatId)
  return phone ? [phone, alternatePhone(phone)].filter(Boolean) : []
}

/**
 * Escuta os tiques (message_ack) das mensagens enviadas e grava entregue/lido/reproduzido
 * no destinatário da transmissão. Acks só chegam com a instância online.
 */
const attachDeliveryTracker = (client, sessionId, resolveCanonicalChatId) => {
  client.on('message_ack', async (message, ack) => {
    if (!message.fromMe || ack < ACK_DELIVERED) return
    const messageId = serializeMessageId(message)
    if (!messageId) return
    try {
      const chatId = await resolveCanonicalChatId(resolveChatId(message))
      const runId = await recordDeliveryAck({
        messageId,
        ack,
        at: new Date(),
        phones: phonesForChat(chatId),
        messageSentAt: new Date(message.timestamp * 1000)
      })
      if (runId) publishPanelEvent({ type: 'broadcast_delivery', sessionId, runId })
    } catch (error) {
      console.warn(`[panel] falha ao registrar entrega sessão=${sessionId} ack=${ack}:`, error.message)
    }
  })
}

module.exports = { attachDeliveryTracker }
