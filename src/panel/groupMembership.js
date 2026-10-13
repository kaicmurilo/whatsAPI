const isGroupChatId = (chatId) => typeof chatId === 'string' && chatId.endsWith('@g.us')

// Roda na página do WhatsApp Web. Mesma checagem da lib (GroupChat): o participante pode estar
// indexado pelo LID ou pelo telefone. Grupo que a instância não conhece ou de onde saiu = não participa.
const isGroupMemberInPage = (groupId) => {
  try {
    const chat = window.require('WAWebCollections').Chat.get(groupId)
    const participants = chat?.groupMetadata?.participants
    if (!participants) return false
    const { getMaybeMeLidUser, getMaybeMePnUser } = window.require('WAWebUserPrefsMeUser')
    return [getMaybeMeLidUser(), getMaybeMePnUser()]
      .some((wid) => wid && Boolean(participants.get(wid._serialized)))
  } catch (error) {
    return false
  }
}

const isGroupMember = async (client, groupId, sessionId) => {
  try {
    return await client.pupPage.evaluate(isGroupMemberInPage, groupId)
  } catch (error) {
    console.warn(`[send] não foi possível checar participação no grupo sessão=${sessionId}:`, error.message)
    return false
  }
}

module.exports = { isGroupChatId, isGroupMember, isGroupMemberInPage }
