const { sendErrorResponse } = require('../utils')
const { listQueuedRecipients, removeQueuedRecipient } = require('./broadcastQueueRepository')
const { parseId, parseBoundedInt, parsePagination, isValidPagination } = require('./validators')

const QUEUE_DEFAULT_PER_PAGE = 5
const MAX_POSITION = 1000000
const REMOVED_REASON = 'Removido da fila pelo usuário'

const getQueuedRecipients = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: QUEUE_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    res.json({ success: true, data: await listQueuedRecipients(req.user.user_id, { ...pagination, search: pagination.search || null }) })
  } catch (error) {
    console.error(`[panel] falha ao listar a fila user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar a fila')
  }
}

const deleteQueuedRecipient = async (req, res) => {
  const userId = req.user.user_id
  const runId = parseId(req.params.runId)
  const position = parseBoundedInt(req.params.position, { fallback: null, min: 0, max: MAX_POSITION })
  if (runId === null || position === null) return sendErrorResponse(res, 422, 'Contato da fila inválido')
  try {
    if (!await removeQueuedRecipient(userId, runId, position, REMOVED_REASON)) {
      return sendErrorResponse(res, 404, 'Contato não está mais na fila (já enviado ou removido)')
    }
    console.log(`[panel] contato removido da fila run=${runId} posição=${position} user=${userId}`)
    res.json({ success: true })
  } catch (error) {
    console.error(`[panel] falha ao remover da fila run=${runId} posição=${position} user=${userId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover da fila')
  }
}

module.exports = { getQueuedRecipients, deleteQueuedRecipient }
