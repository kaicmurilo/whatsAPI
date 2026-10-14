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

// Roda na página: grupos de que a instância participa, com o título que o WhatsApp mostra
const listMemberGroupsInPage = () => {
  try {
    const { getMaybeMeLidUser, getMaybeMePnUser } = window.require('WAWebUserPrefsMeUser')
    const me = [getMaybeMeLidUser(), getMaybeMePnUser()].filter(Boolean).map((wid) => wid._serialized)
    return window.require('WAWebCollections').Chat.getModelsArray()
      .filter((chat) => chat.id?.server === 'g.us')
      .filter((chat) => me.some((id) => chat.groupMetadata?.participants?.get(id)))
      .map((chat) => ({ chatId: chat.id._serialized, name: chat.formattedTitle || chat.name || chat.groupMetadata?.subject || null }))
  } catch (error) {
    return []
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

const listMemberGroups = async (client, sessionId) => {
  try {
    return await client.pupPage.evaluate(listMemberGroupsInPage)
  } catch (error) {
    console.warn(`[panel] não foi possível listar grupos sessão=${sessionId}:`, error.message)
    return []
  }
}

module.exports = { isGroupChatId, isGroupMember, isGroupMemberInPage, listMemberGroups, listMemberGroupsInPage }
