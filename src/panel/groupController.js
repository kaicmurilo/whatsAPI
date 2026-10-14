const AuthService = require('../auth/authService')
const { sendErrorResponse } = require('../utils')
const { getConnectedClient } = require('./broadcastChannels')
const { listMemberGroups } = require('./groupMembership')
const { parsePagination, isValidPagination } = require('./validators')

const GROUPS_DEFAULT_PER_PAGE = 20

const fold = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Junta os grupos de todas as instâncias conectadas (mesmo grupo em duas instâncias vira uma linha
 * com as duas em sessionIds). Ordem pelo nome; sem nome vai para o fim.
 */
const mergeGroups = (perSession) => {
  const byId = new Map()
  for (const { sessionId, groups } of perSession) {
    for (const group of groups) {
      const current = byId.get(group.chatId) || { chatId: group.chatId, name: group.name, sessionIds: [] }
      current.name = current.name || group.name
      current.sessionIds.push(sessionId)
      byId.set(group.chatId, current)
    }
  }
  return [...byId.values()].sort((left, right) =>
    (left.name ? 0 : 1) - (right.name ? 0 : 1) || fold(left.name).localeCompare(fold(right.name)))
}

const filterAndPage = (groups, { page, perPage, search }) => {
  const term = fold(search)
  const matching = term ? groups.filter((group) => fold(group.name).includes(term) || group.chatId.includes(term)) : groups
  return { items: matching.slice((page - 1) * perPage, page * perPage), total: matching.length, page, perPage }
}

// ponytail: lê o Store de cada instância a cada chamada (sem cache); o seletor faz debounce na busca
const getGroups = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: GROUPS_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const rows = await AuthService.getUserSessions(req.user.user_id)
    const connected = rows.map((row) => row.session_id).filter((sessionId) => getConnectedClient(sessionId))
    const perSession = await Promise.all(connected.map(async (sessionId) => ({
      sessionId, groups: await listMemberGroups(getConnectedClient(sessionId), sessionId)
    })))
    res.json({ success: true, data: filterAndPage(mergeGroups(perSession), pagination) })
  } catch (error) {
    console.error(`[panel] falha ao listar grupos user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar grupos')
  }
}

module.exports = { getGroups, mergeGroups, filterAndPage }
