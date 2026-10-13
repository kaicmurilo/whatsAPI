const { sendErrorResponse } = require('../utils')
const { reportTimeZone } = require('../config')
const { isSessionAllowed } = require('../auth/credentialScope')
const { CHAT_ID_PATTERN } = require('../panel/validators')
const { parseSessionIds, listOwnedSessionIds } = require('../panel/broadcastSessions')
const { getConnectedClient } = require('../panel/broadcastChannels')
const { isGroupChatId, isGroupMember } = require('../panel/groupMembership')
const { loadDailyOutgoing } = require('../panel/messageRepository')
const { zonedDayBounds } = require('../panel/sendPolicy')
const { pickBalancedSender } = require('../panel/balancedSender')
const { CONTENT_TYPES, INVALID_CONTENT_TYPE, buildMessageContent } = require('./clientController')

const loadTodayOutgoing = (sessionIds) => {
  const { start, end } = zonedDayBounds(new Date(), reportTimeZone)
  return loadDailyOutgoing(sessionIds, start, end)
}

// Corpo inválido → [status, mensagem]; válido → null
const findBodyError = (body) => {
  if (!Array.isArray(body.sessionIds)) return [422, 'Informe sessionIds: lista de instâncias']
  if (typeof body.chatId !== 'string' || !CHAT_ID_PATTERN.test(body.chatId)) return [422, 'chatId inválido']
  if (!CONTENT_TYPES.includes(body.contentType)) return [422, INVALID_CONTENT_TYPE]
  return null
}

// API key restrita só usa instâncias liberadas; toda instância precisa ser do usuário
const findAccessError = async (req, sessionIds) => {
  if (!sessionIds.every((sessionId) => isSessionAllowed(req.token, sessionId))) {
    return [403, 'Acesso negado: credencial não liberada para uma das instâncias']
  }
  const owned = await listOwnedSessionIds(req.user.user_id, sessionIds)
  if (sessionIds.some((sessionId) => !owned.has(sessionId))) return [403, 'Uma das instâncias não pertence a você']
  return null
}

/**
 * Envia pela instância que menos enviou no dia entre as informadas.
 * Grupo: só entre as que participam do grupo. Contato: entre todas as conectadas.
 */
const sendMessageBalanced = async (req, res) => {
  const body = req.body || {}
  const bodyError = findBodyError(body)
  if (bodyError) return sendErrorResponse(res, ...bodyError)
  const { sessionIds, error: sessionsError } = parseSessionIds(body.sessionIds)
  if (sessionsError) return sendErrorResponse(res, 422, sessionsError)
  const target = isGroupChatId(body.chatId) ? 'grupo' : 'contato'
  try {
    const accessError = await findAccessError(req, sessionIds)
    if (accessError) return sendErrorResponse(res, ...accessError)
    const picked = await pickBalancedSender({
      sessionIds, chatId: body.chatId, getClient: getConnectedClient, isMember: isGroupMember, loadDaily: loadTodayOutgoing
    })
    if (picked.error) return sendErrorResponse(res, ...picked.error)
    const { sessionId, client } = picked.sender
    const content = await buildMessageContent(client, body.contentType, body.content, body.options)
    const message = await client.sendMessage(body.chatId, content, body.options)
    console.log(`[send] envio balanceado sessão=${sessionId} destino=${target} candidatas=${picked.candidates}/${sessionIds.length} user=${req.user.user_id}`)
    res.json({ success: true, sessionId, message })
  } catch (error) {
    console.error(`[send] falha no envio balanceado destino=${target} user=${req.user.user_id}:`, error.message)
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = { sendMessageBalanced, findBodyError }
