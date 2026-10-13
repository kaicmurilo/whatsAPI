const { pickByDailyLoad } = require('./broadcastRunner')
const { isGroupChatId } = require('./groupMembership')

const NONE_CONNECTED = [409, 'Nenhuma das instâncias informadas está conectada']
const NONE_IN_GROUP = [422, 'Nenhuma das instâncias conectadas participa do grupo informado']

const filterGroupMembers = async (sessionIds, groupId, getClient, isMember) => {
  const memberships = await Promise.all(sessionIds.map((sessionId) => isMember(getClient(sessionId), groupId, sessionId)))
  return sessionIds.filter((_, index) => memberships[index])
}

/**
 * Escolhe a instância que menos enviou no dia (empate: a que enviou há mais tempo).
 * Grupo: só concorrem as instâncias conectadas que participam do grupo. Contato: qualquer conectada.
 * ponytail: duas chamadas simultâneas podem escolher a mesma instância (a contagem só sobe quando a
 * mensagem é gravada); para cravar o rodízio sob concorrência, reservar a instância em memória.
 *
 * @returns {Promise<{ sender: { sessionId: string, client: object }, candidates: number } | { error: [number, string] }>}
 */
const pickBalancedSender = async ({ sessionIds, chatId, getClient, isMember, loadDaily }) => {
  const connected = sessionIds.filter((sessionId) => getClient(sessionId))
  if (connected.length === 0) return { error: NONE_CONNECTED }
  const candidates = isGroupChatId(chatId)
    ? await filterGroupMembers(connected, chatId, getClient, isMember)
    : connected
  if (candidates.length === 0) return { error: NONE_IN_GROUP }
  const sender = pickByDailyLoad(candidates, new Set(), getClient, await loadDaily(candidates))
  return { sender, candidates: candidates.length }
}

module.exports = { pickBalancedSender }
