const AuthService = require('../auth/authService')
const { sendErrorResponse } = require('../utils')
const { isRestrictedCredential, isSessionAllowed } = require('../auth/credentialScope')
const { getConnectedClient } = require('./broadcastChannels')
const { parseSessionIds, listOwnedSessionIds } = require('./broadcastSessions')
const { isGroupChatId } = require('./groupMembership')
const { listCachedGroups, findCachedGroup, groupCacheStatus } = require('./groupCacheRepository')
const { refreshSessions } = require('./groupCache')
const { parsePagination, isValidPagination } = require('./validators')

const GROUPS_DEFAULT_PER_PAGE = 5
const AFTER_ADD_REFRESH_MS = 5000

// Credencial restrita só enxerga e mexe nas instâncias liberadas; login do painel e chave sem lista veem todas
const allowedSessionsOf = (token) => (isRestrictedCredential(token) ? token.allowedSessionIds : null)

// GET /panel/groups — também consumido pela API (Bearer wak_...)
const getGroups = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: GROUPS_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listCachedGroups(req.user.user_id, {
      ...pagination,
      search: pagination.search || null,
      allowedSessionIds: allowedSessionsOf(req.token),
      adminOnly: req.query.adminOnly === 'true'
    })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[grupos] falha ao listar grupos user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar grupos')
  }
}

const getGroup = async (req, res) => {
  const { chatId } = req.params
  if (!isGroupChatId(chatId)) return sendErrorResponse(res, 422, 'Id de grupo inválido')
  try {
    const group = await findCachedGroup(req.user.user_id, chatId, allowedSessionsOf(req.token))
    if (!group) return sendErrorResponse(res, 404, 'Grupo não encontrado no cache das suas instâncias')
    res.json({ success: true, data: group })
  } catch (error) {
    console.error(`[grupos] falha ao ler grupo user=${req.user.user_id} grupo=${chatId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao ler grupo')
  }
}

const getGroupCacheStatus = async (req, res) => {
  try {
    res.json({ success: true, data: await groupCacheStatus(req.user.user_id) })
  } catch (error) {
    console.error(`[grupos] falha ao ler status do cache user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao ler cache de grupos')
  }
}

// Atualiza agora o cache das instâncias conectadas do usuário (aguarda terminar)
const postRefreshGroups = async (req, res) => {
  try {
    const rows = await AuthService.getUserSessions(req.user.user_id)
    const allowed = allowedSessionsOf(req.token)
    const sessionIds = rows.map((row) => row.session_id)
      .filter((sessionId) => !allowed || allowed.includes(sessionId))
      .filter((sessionId) => getConnectedClient(sessionId))
    await refreshSessions(sessionIds)
    res.json({ success: true, data: { refreshedSessions: sessionIds.length, ...(await groupCacheStatus(req.user.user_id)) } })
  } catch (error) {
    console.error(`[grupos] falha ao atualizar cache user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao atualizar grupos')
  }
}

// Resultado da lib por participante → status legível por instância
const describeAddResult = (sessionId, result) => {
  if (!result) return { sessionId, status: 'failed', message: 'Sem resposta do WhatsApp' }
  if (result.code === 200) return { sessionId, status: 'added', message: 'Adicionada' }
  if (result.isInviteV4Sent) return { sessionId, status: 'invited', message: 'Não pôde ser adicionada direto; convite enviado' }
  return { sessionId, status: 'failed', message: result.message || `Código ${result.code}` }
}

const findAddError = async (req, sessionIds) => {
  if (!sessionIds.every((sessionId) => isSessionAllowed(req.token, sessionId))) return [403, 'Acesso negado: credencial não liberada para uma das instâncias']
  const owned = await listOwnedSessionIds(req.user.user_id, sessionIds)
  if (sessionIds.some((sessionId) => !owned.has(sessionId))) return [403, 'Uma das instâncias não pertence a você']
  return null
}

/**
 * POST /panel/groups/:chatId/members { sessionIds } — uma instância sua que é admin do grupo adiciona as outras.
 * Instância desconectada não tem número conhecido: volta como "offline" sem tentar.
 */
const postGroupMembers = async (req, res) => {
  const { chatId } = req.params
  if (!isGroupChatId(chatId)) return sendErrorResponse(res, 422, 'Id de grupo inválido')
  const { sessionIds, error } = parseSessionIds(req.body?.sessionIds)
  if (error) return sendErrorResponse(res, 422, error)
  const userId = req.user.user_id
  try {
    const accessError = await findAddError(req, sessionIds)
    if (accessError) return sendErrorResponse(res, ...accessError)
    const group = await findCachedGroup(userId, chatId, allowedSessionsOf(req.token))
    if (!group) return sendErrorResponse(res, 404, 'Grupo não encontrado no cache das suas instâncias')
    const adminSessionId = group.adminSessionIds.find((sessionId) => getConnectedClient(sessionId) && isSessionAllowed(req.token, sessionId))
    if (!adminSessionId) return sendErrorResponse(res, 409, 'Nenhuma instância sua conectada é admin deste grupo')

    const results = []
    const toAdd = new Map()
    for (const sessionId of sessionIds) {
      const wid = getConnectedClient(sessionId)?.info?.wid?._serialized
      if (group.memberSessionIds.includes(sessionId)) results.push({ sessionId, status: 'already', message: 'Já está no grupo' })
      else if (!wid) results.push({ sessionId, status: 'offline', message: 'Instância desconectada: número desconhecido' })
      else toAdd.set(wid, sessionId)
    }
    if (toAdd.size > 0) {
      const chat = await getConnectedClient(adminSessionId).getChatById(chatId)
      const outcome = await chat.addParticipants([...toAdd.keys()], { autoSendInviteV4: true })
      if (typeof outcome === 'string') return sendErrorResponse(res, 502, `WhatsApp recusou: ${outcome}`)
      for (const [wid, sessionId] of toAdd) results.push(describeAddResult(sessionId, outcome[wid]))
    }
    console.log(`[grupos] adicionar instâncias grupo=${chatId} via=${adminSessionId} user=${userId} ${results.map((r) => `${r.sessionId}:${r.status}`).join(' ')}`)
    // Quem entrou só aparece no cache depois que o WhatsApp sincroniza
    setTimeout(() => refreshSessions([adminSessionId, ...toAdd.values()]), AFTER_ADD_REFRESH_MS).unref?.()
    res.json({ success: true, data: { via: adminSessionId, results } })
  } catch (addError) {
    console.error(`[grupos] falha ao adicionar instâncias grupo=${chatId} user=${userId}:`, addError)
    sendErrorResponse(res, 500, 'Erro ao adicionar instâncias no grupo')
  }
}

module.exports = { getGroups, getGroup, getGroupCacheStatus, postRefreshGroups, postGroupMembers, describeAddResult }
