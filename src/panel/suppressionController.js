const { sendErrorResponse } = require('../utils')
const { listSuppressed, removeSuppressed } = require('./suppressionRepository')
const { parseBoundedInt, parsePagination, isValidPagination } = require('./validators')

const SUPPRESSED_PER_PAGE = 20

const getSuppressed = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: SUPPRESSED_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listSuppressed(req.user.user_id, { ...pagination, search: pagination.search || null })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[panel] falha ao listar supressão user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar números suprimidos')
  }
}

const deleteSuppressed = async (req, res) => {
  const id = parseBoundedInt(req.params.suppressionId, { fallback: null, min: 1, max: Number.MAX_SAFE_INTEGER })
  if (id === null) return sendErrorResponse(res, 422, 'Id inválido')
  try {
    const removed = await removeSuppressed(req.user.user_id, id)
    if (!removed) return sendErrorResponse(res, 404, 'Número não está na supressão')
    console.log(`[panel] supressão removida user=${req.user.user_id} id=${id}`)
    res.json({ success: true })
  } catch (error) {
    console.error(`[panel] falha ao remover supressão user=${req.user.user_id} id=${id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover número da supressão')
  }
}

module.exports = { getSuppressed, deleteSuppressed }
