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

// Roda na página: grupos de que a instância participa, com tamanho, admins e se ela é admin.
// null = não deu para ler (quem chama não pode confundir com "saiu de todos os grupos").
const readGroupsInPage = () => {
  try {
    const { Chat, Contact } = window.require('WAWebCollections')
    const { getMaybeMeLidUser, getMaybeMePnUser } = window.require('WAWebUserPrefsMeUser')
    const me = [getMaybeMeLidUser(), getMaybeMePnUser()].filter(Boolean).map((wid) => wid._serialized)
    const describe = (participant) => {
      const id = participant.id._serialized
      const contact = Contact.get(id)
      const phone = participant.id.server === 'c.us' ? participant.id.user : (contact?.phoneNumber?.user || null)
      return { id, phone, name: contact?.name || contact?.pushname || contact?.verifiedName || null, isSuperAdmin: Boolean(participant.isSuperAdmin) }
    }
    return Chat.getModelsArray()
      .filter((chat) => chat.id?.server === 'g.us')
      .flatMap((chat) => {
        const participants = chat.groupMetadata?.participants
        const mine = participants && me.map((id) => participants.get(id)).find(Boolean)
        if (!mine) return []
        const all = typeof participants.getModelsArray === 'function' ? participants.getModelsArray() : []
        return [{
          chatId: chat.id._serialized,
          name: chat.formattedTitle || chat.name || chat.groupMetadata?.subject || null,
          size: all.length,
          isAdmin: Boolean(mine.isAdmin || mine.isSuperAdmin),
          admins: all.filter((participant) => participant.isAdmin || participant.isSuperAdmin).map(describe)
        }]
      })
  } catch (error) {
    return null
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

// null = falhou a leitura (página fora do ar, Store mudou)
const readGroups = async (client, sessionId) => {
  try {
    return await client.pupPage.evaluate(readGroupsInPage)
  } catch (error) {
    console.warn(`[grupos] não foi possível ler grupos sessão=${sessionId}:`, error.message)
    return null
  }
}

module.exports = { isGroupChatId, isGroupMember, isGroupMemberInPage, readGroups, readGroupsInPage }
