const LID_SUFFIX = '@lid'

/**
 * O WhatsApp passou a identificar parte dos chats por LID (id de privacidade, sem telefone).
 * Gravar sempre no formato telefone@c.us mantém um chat só por pessoa: casa com a agenda,
 * com "Nova conversa" (getNumberId devolve @c.us) e com mensagens antigas.
 * Sem mapeamento disponível, o LID é mantido.
 */
const createChatIdResolver = (client, sessionId) => {
  const cache = new Map()

  const lookupPhoneId = async (lid) => {
    try {
      const [mapping] = await client.getContactLidAndPhone([lid])
      return mapping?.pn || lid
    } catch (error) {
      console.warn(`[panel] sem telefone para LID sessão=${sessionId} lid=${lid}:`, error.message)
      return lid
    }
  }

  return async (chatId) => {
    if (!chatId?.endsWith(LID_SUFFIX)) return chatId
    if (!cache.has(chatId)) cache.set(chatId, lookupPhoneId(chatId))
    return cache.get(chatId)
  }
}

module.exports = { createChatIdResolver }
