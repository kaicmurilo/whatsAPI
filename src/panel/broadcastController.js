const { sendErrorResponse } = require('../utils')
const { listRuns, findRun } = require('./broadcastRunRepository')
const broadcastService = require('./broadcastService')
const { parsePacing } = require('./broadcastPacing')
const { parseScheduledAt } = require('./broadcastSchedule')
const { parseId, parsePagination, isValidPagination } = require('./validators')

const MAX_TEXT_LENGTH = 4096
const RUNS_DEFAULT_PER_PAGE = 5

const isPresent = (value) => value !== undefined && value !== null && value !== ''

// Conteúdo: modelo salvo (templateId) OU avulso (texto e/ou 1 arquivo) — nunca os dois.
// templateId enviado mas vazio é erro: nunca pode "cair" silenciosamente num envio avulso.
const parseContent = (body) => {
  if (body?.templateId !== undefined && body?.templateId !== null) {
    const templateId = parseId(String(body.templateId))
    if (templateId === null) return { error: 'Modelo inválido' }
    if (isPresent(body?.text) || isPresent(body?.fileId)) return { error: 'Use o modelo ou escreva a mensagem, não os dois' }
    return { content: { templateId } }
  }
  const fileId = isPresent(body?.fileId) ? parseId(String(body.fileId)) : null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (isPresent(body?.fileId) && fileId === null) return { error: 'Arquivo inválido' }
  if (text.length > MAX_TEXT_LENGTH) return { error: `Texto maior que ${MAX_TEXT_LENGTH} caracteres` }
  if (!text && fileId === null) return { error: 'Escolha um modelo ou escreva a mensagem' }
  return { content: { fileId, text: text || null } }
}

const parseBroadcastInput = (body) => {
  const listId = parseId(body?.listId === undefined ? undefined : String(body.listId))
  if (listId === null) return { error: 'Escolha uma lista de transmissão' }
  const { content, error } = parseContent(body)
  if (error) return { error }
  const { pacing, error: pacingError } = parsePacing(body?.pacing)
  if (pacingError) return { error: pacingError }
  const { scheduledAt, error: scheduleError } = parseScheduledAt(body?.scheduledAt)
  if (scheduleError) return { error: scheduleError }
  return { input: { listId, pacing, ...content }, scheduledAt }
}

// Com scheduledAt → programa; sem → dispara agora
const startBroadcast = async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user.user_id
  const { input, scheduledAt, error } = parseBroadcastInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const result = scheduledAt
      ? await broadcastService.schedule(userId, sessionId, input, scheduledAt)
      : await broadcastService.startNow(userId, sessionId, input)
    if (result.error) return sendErrorResponse(res, ...result.error)
    res.status(scheduledAt ? 201 : 202).json({ success: true, data: result.run })
  } catch (startError) {
    console.error(`[panel] falha ao ${scheduledAt ? 'programar' : 'iniciar'} disparo sessão=${sessionId} user=${userId}:`, startError)
    sendErrorResponse(res, 500, scheduledAt ? 'Erro ao programar disparo' : 'Erro ao iniciar disparo')
  }
}

const retryBroadcast = async (req, res) => {
  const userId = req.user.user_id
  const runId = parseId(req.params.runId)
  if (runId === null) return sendErrorResponse(res, 422, 'Id de disparo inválido')
  try {
    const result = await broadcastService.retry(userId, runId)
    if (result.error) return sendErrorResponse(res, ...result.error)
    res.status(202).json({ success: true, data: result.run })
  } catch (retryError) {
    console.error(`[panel] falha ao reprocessar disparo run=${runId} user=${userId}:`, retryError)
    sendErrorResponse(res, 500, 'Erro ao reprocessar disparo')
  }
}

const cancelBroadcast = async (req, res) => {
  const userId = req.user.user_id
  const runId = parseId(req.params.runId)
  if (runId === null) return sendErrorResponse(res, 422, 'Id de disparo inválido')
  try {
    const result = await broadcastService.cancel(userId, runId)
    if (result.error) return sendErrorResponse(res, ...result.error)
    if (result.status === 'canceling') return res.status(202).json({ success: true, message: 'Cancelando: nenhum novo contato será enviado' })
    res.json({ success: true, data: result.run })
  } catch (cancelError) {
    console.error(`[panel] falha ao cancelar disparo run=${runId} user=${userId}:`, cancelError)
    sendErrorResponse(res, 500, 'Erro ao cancelar disparo')
  }
}

const getRuns = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: RUNS_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação inválidos')
  try {
    res.json({ success: true, data: await listRuns(req.user.user_id, pagination) })
  } catch (error) {
    console.error(`[panel] falha ao listar disparos user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar disparos')
  }
}

const getRun = async (req, res) => {
  const runId = parseId(req.params.runId)
  if (runId === null) return sendErrorResponse(res, 422, 'Id de disparo inválido')
  try {
    const run = await findRun(req.user.user_id, runId)
    if (!run) return sendErrorResponse(res, 404, 'Disparo não encontrado')
    res.json({ success: true, data: run })
  } catch (error) {
    console.error(`[panel] falha ao buscar disparo user=${req.user.user_id} id=${runId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao buscar disparo')
  }
}

module.exports = { startBroadcast, retryBroadcast, cancelBroadcast, getRuns, getRun }
