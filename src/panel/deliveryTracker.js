const { recordDeliveryAck } = require('./deliveryRepository')
const { resolveChatId, serializeMessageId, messageKeyOf } = require('./messageMapper')
const { phoneFromChatId, alternatePhone } = require('./phone')
const { publishPanelEvent } = require('./panelEvents')

const ACK_DELIVERED = 2
const ACK_LABELS = { 2: 'entregue', 3: 'lido', 4: 'reproduzido' }

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
    const messageKey = messageKeyOf(message)
    if (!messageKey) return
    try {
      const chatId = await resolveCanonicalChatId(resolveChatId(message))
      const runId = await recordDeliveryAck({
        messageId: serializeMessageId(message),
        messageKey,
        ack,
        at: new Date(),
        phones: phonesForChat(chatId),
        messageSentAt: new Date(message.timestamp * 1000)
      })
      if (!runId) return // ack de conversa comum, não de transmissão
      console.log(`[panel] tique ${ACK_LABELS[ack] ?? ack} registrado run=${runId} sessão=${sessionId}`)
      publishPanelEvent({ type: 'broadcast_delivery', sessionId, runId })
    } catch (error) {
      console.warn(`[panel] falha ao registrar entrega sessão=${sessionId} ack=${ack}:`, error.message)
    }
  })
}

module.exports = { attachDeliveryTracker }
