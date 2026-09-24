const { sessions, validateSession } = require('../sessions')
const { sendErrorResponse } = require('../utils')
const { findBroadcastList } = require('./broadcastListRepository')
const { createRun, recordRecipientResult, finishRun, listRuns, findRun, reopenRunForRetry } = require('./broadcastRunRepository')
const { runBroadcast, CANCELED_REASON } = require('./broadcastRunner')
const { loadOwnedMedia } = require('./mediaLoader')
const { isSessionOwnedBy } = require('./messageRepository')
const { publishPanelEvent } = require('./panelEvents')
const { parsePacing, pacingOfRun } = require('./broadcastPacing')
const { parseId, parsePagination, isValidPagination } = require('./validators')

const MAX_TEXT_LENGTH = 4096
const RUNS_DEFAULT_PER_PAGE = 5

// ponytail: estado em memória — vale para uma réplica da API (é o caso do Docker local).
// busySessions: dois disparos simultâneos na mesma instância dobrariam o ritmo e o risco de bloqueio.
// activeRuns: AbortController de cada disparo em andamento, usado pelo botão "Abortar".
const busySessions = new Set()
const activeRuns = new Map()

const parseBroadcastInput = (body) => {
  const listId = parseId(body?.listId === undefined ? undefined : String(body.listId))
  const fileId = body?.fileId === undefined || body.fileId === null ? null : parseId(String(body.fileId))
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (listId === null) return { error: 'Escolha uma lista de transmissão' }
  if (body?.fileId !== undefined && body.fileId !== null && fileId === null) return { error: 'Arquivo inválido' }
  if (text.length > MAX_TEXT_LENGTH) return { error: `Texto maior que ${MAX_TEXT_LENGTH} caracteres` }
  if (!text && fileId === null) return { error: 'Escreva uma mensagem ou escolha um arquivo' }
  const { pacing, error: pacingError } = parsePacing(body?.pacing)
  if (pacingError) return { error: pacingError }
  return { input: { listId, fileId, text: text || null, pacing } }
}

const publishProgress = (sessionId, run) => {
  if (run) publishPanelEvent({ type: 'broadcast_progress', sessionId, run })
}

// Roda em segundo plano; o HTTP já respondeu 202. Tudo é logado — nada falha em silêncio.
const executeInBackground = ({ sessionId, run, recipients, text, media, mediaOptions, pacing }) => {
  const controller = new AbortController()
  busySessions.add(sessionId)
  activeRuns.set(String(run.id), controller)
  const startedAt = Date.now()
  runBroadcast({ id: run.id, recipients, text, media, mediaOptions, pacing, signal: controller.signal }, {
    getClient: () => sessions.get(sessionId) || null,
    recordResult: recordRecipientResult,
    finish: finishRun,
    publish: (progress) => publishProgress(sessionId, progress)
  })
    .then(() => console.log(`[panel] disparo concluído run=${run.id} sessão=${sessionId} destinatários=${recipients.length} em ${Date.now() - startedAt}ms`))
    .catch((error) => {
      console.error(`[panel] disparo abortado run=${run.id} sessão=${sessionId}:`, error)
      return finishRun(run.id, 'failed', `Erro interno ao registrar o envio: ${error.message}`)
        .then((finished) => publishProgress(sessionId, finished))
        .catch((finishError) => console.error(`[panel] falha ao encerrar disparo run=${run.id}:`, finishError.message))
    })
    .finally(() => {
      busySessions.delete(sessionId)
      activeRuns.delete(String(run.id))
    })
}

const loadMediaForRun = async (userId, fileId) => {
  if (fileId === null) return { media: null, mediaOptions: {}, fileName: null }
  const loaded = await loadOwnedMedia(userId, fileId)
  return loaded ? { media: loaded.media, mediaOptions: loaded.sendOptions, fileName: loaded.file.name } : null
}

const startBroadcast = async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user.user_id
  const { input, error } = parseBroadcastInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  if (busySessions.has(sessionId)) return sendErrorResponse(res, 409, 'Já existe um disparo em andamento nesta instância')
  try {
    const list = await findBroadcastList(userId, input.listId)
    if (!list) return sendErrorResponse(res, 404, 'Lista não encontrada')
    if (list.members.length === 0) return sendErrorResponse(res, 422, 'A lista não tem contatos')
    const loadedMedia = await loadMediaForRun(userId, input.fileId)
    if (!loadedMedia) return sendErrorResponse(res, 404, 'Arquivo não encontrado')

    const recipients = list.members.map((member, position) => ({ position, name: member.name, phone: member.phone }))
    const run = await createRun(userId, {
      sessionId, listId: list.id, listName: list.name, text: input.text, fileId: input.fileId, fileName: loadedMedia.fileName, recipients, pacing: input.pacing
    })
    console.log(`[panel] disparo iniciado run=${run.id} sessão=${sessionId} lista=${list.id} total=${recipients.length} arquivo=${input.fileId ?? '-'} intervalo=${input.pacing.minSeconds}-${input.pacing.maxSeconds}s aleatório=${input.pacing.randomOrder} user=${userId}`)
    executeInBackground({ sessionId, run, recipients, text: input.text, media: loadedMedia.media, mediaOptions: loadedMedia.mediaOptions, pacing: input.pacing })
    res.status(202).json({ success: true, data: run })
  } catch (startError) {
    console.error(`[panel] falha ao iniciar disparo sessão=${sessionId} user=${userId}:`, startError)
    sendErrorResponse(res, 500, 'Erro ao iniciar disparo')
  }
}

// Tudo que impede reprocessar, na ordem em que o usuário consegue resolver; null = pode seguir
const findRetryBlocker = async (userId, run) => {
  if (run.status === 'running') return [409, 'Este disparo ainda está em andamento']
  if (run.recipients.every((recipient) => recipient.status === 'sent')) return [422, 'Todos os contatos já receberam']
  if (!await isSessionOwnedBy(run.sessionId, userId)) return [403, 'A instância deste disparo não pertence a você']
  if (!(await validateSession(run.sessionId)).success) return [409, 'A instância deste disparo não está conectada']
  if (busySessions.has(run.sessionId)) return [409, 'Já existe um disparo em andamento nesta instância']
  if (run.fileName && !run.fileId) return [404, 'O arquivo deste disparo foi excluído da biblioteca']
  return null
}

// Reenvia só para quem não recebeu, no mesmo registro de histórico
const retryBroadcast = async (req, res) => {
  const userId = req.user.user_id
  const runId = parseId(req.params.runId)
  if (runId === null) return sendErrorResponse(res, 422, 'Id de disparo inválido')
  try {
    const run = await findRun(userId, runId)
    if (!run) return sendErrorResponse(res, 404, 'Disparo não encontrado')
    const blocker = await findRetryBlocker(userId, run)
    if (blocker) return sendErrorResponse(res, ...blocker)
    const loadedMedia = await loadMediaForRun(userId, run.fileId === null ? null : Number(run.fileId))
    if (!loadedMedia) return sendErrorResponse(res, 404, 'O arquivo deste disparo foi excluído da biblioteca')

    const reopened = await reopenRunForRetry(runId)
    if (!reopened) return sendErrorResponse(res, 409, 'Este disparo ainda está em andamento')
    console.log(`[panel] disparo reprocessado run=${runId} sessão=${run.sessionId} pendentes=${reopened.recipients.length} user=${userId}`)
    executeInBackground({
      sessionId: run.sessionId,
      run: reopened.run,
      recipients: reopened.recipients,
      text: run.text,
      media: loadedMedia.media,
      mediaOptions: loadedMedia.mediaOptions,
      pacing: pacingOfRun(run)
    })
    publishProgress(run.sessionId, reopened.run)
    res.status(202).json({ success: true, data: reopened.run })
  } catch (retryError) {
    console.error(`[panel] falha ao reprocessar disparo run=${runId} user=${userId}:`, retryError)
    sendErrorResponse(res, 500, 'Erro ao reprocessar disparo')
  }
}

/**
 * Aborta um disparo em andamento. O executor para antes do próximo contato (a espera é interrompida na hora);
 * quem não recebeu fica pendente e pode ser reprocessado depois.
 */
const cancelBroadcast = async (req, res) => {
  const userId = req.user.user_id
  const runId = parseId(req.params.runId)
  if (runId === null) return sendErrorResponse(res, 422, 'Id de disparo inválido')
  try {
    const run = await findRun(userId, runId)
    if (!run) return sendErrorResponse(res, 404, 'Disparo não encontrado')
    if (run.status !== 'running') return sendErrorResponse(res, 409, 'Este disparo não está em andamento')

    const controller = activeRuns.get(String(runId))
    if (controller) {
      controller.abort()
      console.log(`[panel] disparo abortado pelo usuário run=${runId} user=${userId}`)
      return res.status(202).json({ success: true, message: 'Cancelando: nenhum novo contato será enviado' })
    }
    // "running" sem executor neste processo (ex.: reinício no meio): só fecha o registro
    const finished = await finishRun(runId, 'canceled', CANCELED_REASON)
    publishProgress(run.sessionId, finished)
    console.warn(`[panel] disparo órfão cancelado run=${runId} user=${userId}`)
    res.json({ success: true, data: finished })
  } catch (cancelError) {
    console.error(`[panel] falha ao abortar disparo run=${runId} user=${userId}:`, cancelError)
    sendErrorResponse(res, 500, 'Erro ao abortar disparo')
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
