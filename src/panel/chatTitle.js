/**
 * Título útil de um chat. O id cru (`1203…@g.us` ou só o usuário do JID) não é nome:
 * no WhatsApp Web atual o `formattedTitle` de grupo às vezes volta assim, e o assunto
 * real está em `groupMetadata.subject`.
 */
const pickChatTitle = (chatId, ...candidates) => {
  const id = typeof chatId === 'string' ? chatId : ''
  const bare = id.split('@')[0]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (!trimmed || trimmed === id || trimmed === bare) continue
    return trimmed
  }
  return null
}

/**
 * Roda dentro da página do WhatsApp (puppeteer evaluate). Não usa getChatModel:
 * no Web atual ele lança erro minificado ao serializar grupo, e `message.getChat()` cai nesse caminho.
 * Só lê o model já carregado no Store.
 */
const readChatTitleCandidatesInPage = (chatId) => {
  try {
    const collections = window.require('WAWebCollections')
    const wid = window.require('WAWebWidFactory').createWid(chatId)
    const chat = collections.Chat.get(chatId) || collections.Chat.get(wid)
    if (!chat) return []
    const metadata = chat.groupMetadata
    return [
      chat.formattedTitle || null,
      chat.name || null,
      (metadata && metadata.subject) || null
    ]
  } catch (error) {
    return []
  }
}

module.exports = { pickChatTitle, readChatTitleCandidatesInPage }
