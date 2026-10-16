const { sendErrorResponse } = require('../utils')
const { isSessionAllowed, allowedSessionsOf } = require('../auth/credentialScope')
const { CHAT_ID_PATTERN } = require('../panel/validators')
const { parseSessionIds, listOwnedSessionIds } = require('../panel/broadcastSessions')
const { getConnectedClient } = require('../panel/broadcastChannels')
const { isGroupChatId, isGroupMember } = require('../panel/groupMembership')
const { recordApiSend, loadTodayApiSends } = require('../panel/apiSendRepository')
const { pickBalancedSender } = require('../panel/balancedSender')
const { CONTENT_TYPES, INVALID_CONTENT_TYPE, buildMessageContent } = require('./clientController')
const { queueIfBatching, batchedResponse } = require('../panel/messageBatcher')

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
 * Envia pela instância que menos enviou pela integração no dia entre as informadas.
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
    // Agrupado: a instância é escolhida na hora do disparo, com a carga daquele momento
    const queued = await queueIfBatching({ userId: req.user.user_id, chatId: body.chatId, sessionIds, isBalanced: true, allowedSessionIds: allowedSessionsOf(req.token), contentType: body.contentType, content: body.content, options: body.options, credentialId: req.token?.apiCredentialId })
    if (queued) return res.status(202).json(batchedResponse(queued))
    const picked = await pickBalancedSender({
      sessionIds, chatId: body.chatId, getClient: getConnectedClient, isMember: isGroupMember, loadDaily: loadTodayApiSends
    })
    if (picked.error) return sendErrorResponse(res, ...picked.error)
    const { sessionId, client } = picked.sender
    const content = await buildMessageContent(client, body.contentType, body.content, body.options)
    const message = await client.sendMessage(body.chatId, content, body.options)
    recordApiSend({ sessionId, chatId: body.chatId, message, credentialId: req.token?.apiCredentialId })
    console.log(`[send] envio balanceado sessão=${sessionId} destino=${target} candidatas=${picked.candidates}/${sessionIds.length} user=${req.user.user_id}`)
    res.json({ success: true, sessionId, message })
  } catch (error) {
    console.error(`[send] falha no envio balanceado destino=${target} user=${req.user.user_id}:`, error.message)
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = { sendMessageBalanced, findBodyError }
