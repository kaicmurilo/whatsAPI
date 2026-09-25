const { sessions, validateSession } = require('../sessions')
const { findBroadcastList } = require('./broadcastListRepository')
const runs = require('./broadcastRunRepository')
const { runBroadcast, CANCELED_REASON } = require('./broadcastRunner')
const { findTemplate } = require('./templateRepository')
const { findOwnedFile } = require('./fileRepository')
const { partsFromTemplate, partsFromAdHoc, partsOfRun, trackedPartIndex, loadRuntimeParts } = require('./messageParts')
const { isSessionOwnedBy } = require('./messageRepository')
const { publishPanelEvent } = require('./panelEvents')
const { pacingOfRun } = require('./broadcastPacing')

// ponytail: estado em memória — vale para uma réplica da API (é o caso do Docker local).
// busySessions: dois disparos simultâneos na mesma instância dobrariam o ritmo e o risco de bloqueio.
// activeRuns: AbortController de cada disparo em andamento, usado pelo botão "Abortar".
const busySessions = new Set()
const activeRuns = new Map()

const isSessionBusy = (sessionId) => busySessions.has(sessionId)

const publishProgress = (sessionId, run) => {
  if (run) publishPanelEvent({ type: 'broadcast_progress', sessionId, run })
}

// Roda em segundo plano (o HTTP/agendador não espera). Tudo é logado — nada falha em silêncio.
const executeInBackground = ({ sessionId, run, recipients, storedParts, runtimeParts, pacing }) => {
  const controller = new AbortController()
  busySessions.add(sessionId)
  activeRuns.set(String(run.id), controller)
  const startedAt = Date.now()
  runBroadcast({ id: run.id, recipients, parts: runtimeParts, trackedPart: trackedPartIndex(storedParts), pacing, signal: controller.signal }, {
    getClient: () => sessions.get(sessionId) || null,
    recordResult: runs.recordRecipientResult,
    finish: runs.finishRun,
    publish: (progress) => publishProgress(sessionId, progress)
  })
    .then(() => console.log(`[panel] disparo concluído run=${run.id} sessão=${sessionId} destinatários=${recipients.length} em ${Date.now() - startedAt}ms`))
    .catch((error) => {
      console.error(`[panel] disparo abortado run=${run.id} sessão=${sessionId}:`, error)
      return runs.finishRun(run.id, 'failed', `Erro interno ao registrar o envio: ${error.message}`)
        .then((finished) => publishProgress(sessionId, finished))
        .catch((finishError) => console.error(`[panel] falha ao encerrar disparo run=${run.id}:`, finishError.message))
    })
    .finally(() => {
      busySessions.delete(sessionId)
      activeRuns.delete(String(run.id))
    })
}

/**
 * Conteúdo do disparo: partes (cópia no histórico) + colunas de exibição.
 * @returns {{ content?: object, error?: [number, string] }}
 */
const buildContent = async (userId, input) => {
  if (input.templateId) {
    const template = await findTemplate(userId, input.templateId)
    if (!template) return { error: [404, 'Modelo não encontrado'] }
    return { content: { storedParts: partsFromTemplate(template), templateId: template.id, templateName: template.name, text: template.text, fileId: null, fileName: null } }
  }
  const file = input.fileId === null ? null : await findOwnedFile(userId, input.fileId)
  if (input.fileId !== null && !file) return { error: [404, 'Arquivo não encontrado'] }
  const fileName = file?.name ?? null
  return { content: { storedParts: partsFromAdHoc({ text: input.text, fileId: input.fileId, fileName }), templateId: null, templateName: null, text: input.text, fileId: input.fileId, fileName } }
}

/**
 * Lista + conteúdo + mídia carregada, validados. Usado no envio imediato, no agendamento (validação antecipada)
 * e no horário programado (com a lista e a mensagem como estiverem).
 * @returns {{ prepared?: object, error?: [number, string] }}
 */
const prepareBroadcast = async (userId, input) => {
  const list = await findBroadcastList(userId, input.listId)
  if (!list) return { error: [404, 'Lista não encontrada'] }
  if (list.members.length === 0) return { error: [422, 'A lista não tem contatos'] }
  const built = await buildContent(userId, input)
  if (built.error) return built
  const loaded = await loadRuntimeParts(userId, built.content.storedParts)
  if (loaded.missingFile) return { error: [404, `Arquivo não encontrado: ${loaded.missingFile}`] }
  const recipients = list.members.map((member, position) => ({ position, name: member.name, phone: member.phone }))
  return { prepared: { list, recipients, content: built.content, runtimeParts: loaded.parts } }
}

const startNow = async (userId, sessionId, input) => {
  if (!(await validateSession(sessionId)).success) return { error: [409, 'A instância não está conectada'] }
  if (isSessionBusy(sessionId)) return { error: [409, 'Já existe um disparo em andamento nesta instância'] }
  const { prepared, error } = await prepareBroadcast(userId, input)
  if (error) return { error }
  const { list, recipients, content, runtimeParts } = prepared
  const { storedParts, ...display } = content
  const run = await runs.createRun(userId, {
    sessionId, listId: list.id, listName: list.name, recipients, pacing: input.pacing, parts: storedParts, ...display
  })
  console.log(`[panel] disparo iniciado run=${run.id} sessão=${sessionId} lista=${list.id} total=${recipients.length} partes=${storedParts.length} modelo=${display.templateId ?? '-'} intervalo=${input.pacing.minSeconds}-${input.pacing.maxSeconds}s aleatório=${input.pacing.randomOrder} user=${userId}`)
  executeInBackground({ sessionId, run, recipients, storedParts, runtimeParts, pacing: input.pacing })
  return { run }
}

// Valida agora (lista/modelo/arquivo existem) para não descobrir o erro só no horário
const schedule = async (userId, sessionId, input, scheduledAt) => {
  const { prepared, error } = await prepareBroadcast(userId, input)
  if (error) return { error }
  const { list, content } = prepared
  const run = await runs.createScheduledRun(userId, {
    sessionId,
    listId: list.id,
    listName: list.name,
    templateId: content.templateId,
    templateName: content.templateName,
    text: input.templateId ? null : content.text,
    fileId: content.fileId,
    fileName: content.fileName,
    pacing: input.pacing,
    scheduledAt
  })
  console.log(`[panel] disparo programado run=${run.id} sessão=${sessionId} lista=${list.id} para=${scheduledAt.toISOString()} modelo=${content.templateId ?? '-'} user=${userId}`)
  return { run }
}

// Disparo salvo → entrada equivalente à do formulário
const inputOfScheduledRun = (run) => ({
  listId: run.listId,
  pacing: pacingOfRun(run),
  ...(run.templateId ? { templateId: run.templateId } : { text: run.text, fileId: run.fileId })
})

// FKs viram NULL quando lista/modelo/arquivo são apagados; o nome guardado mostra que existia
const findMissingScheduledItem = (run) => {
  if (!run.listId) return 'A lista programada foi excluída'
  if (run.templateName && !run.templateId) return 'O modelo programado foi excluído'
  if (run.fileName && !run.fileId) return 'O arquivo programado foi excluído da biblioteca'
  return null
}

const failScheduled = async (run, reason) => {
  const finished = await runs.finishRun(run.id, 'failed', reason)
  publishProgress(run.sessionId, finished)
  console.warn(`[panel] disparo programado falhou run=${run.id}: ${reason}`)
}

/**
 * Horário chegou: reserva (atômico), monta destinatários/partes com os dados atuais e dispara.
 * Lista/modelo/arquivo apagados desde o agendamento → falha com o motivo.
 */
const startScheduled = async (run) => {
  const claimed = await runs.claimScheduledRun(run.id)
  if (!claimed) return // outro tick já pegou, ou foi cancelado
  // Depois do claim o disparo está "running": qualquer erro precisa fechá-lo, senão fica preso sem executor
  try {
    const missing = findMissingScheduledItem(run)
    if (missing) return await failScheduled(run, missing)
    const { prepared, error } = await prepareBroadcast(run.userId, inputOfScheduledRun(run))
    if (error) return await failScheduled(run, error[1])
    const { list, recipients, content, runtimeParts } = prepared
    const populated = await runs.populateScheduledRun(run.id, {
      listName: list.name, templateName: content.templateName, text: content.text, fileName: content.fileName, recipients, parts: content.storedParts
    })
    console.log(`[panel] disparo programado iniciado run=${run.id} sessão=${run.sessionId} total=${recipients.length}`)
    publishProgress(run.sessionId, populated)
    executeInBackground({ sessionId: run.sessionId, run: populated, recipients, storedParts: content.storedParts, runtimeParts, pacing: pacingOfRun(run) })
  } catch (error) {
    console.error(`[panel] falha ao iniciar disparo programado run=${run.id}:`, error)
    await failScheduled(run, `Erro interno ao iniciar no horário: ${error.message}`)
  }
}

// Tudo que impede reprocessar, na ordem em que o usuário consegue resolver; null = pode seguir
const findRetryBlocker = async (userId, run) => {
  if (run.status === 'running') return [409, 'Este disparo ainda está em andamento']
  if (run.status === 'scheduled') return [409, 'Este disparo ainda está programado']
  if (run.recipients.length === 0) return [422, 'Este disparo não chegou a ter destinatários']
  if (run.recipients.every((recipient) => recipient.status === 'sent')) return [422, 'Todos os contatos já receberam']
  if (!await isSessionOwnedBy(run.sessionId, userId)) return [403, 'A instância deste disparo não pertence a você']
  if (!(await validateSession(run.sessionId)).success) return [409, 'A instância deste disparo não está conectada']
  if (isSessionBusy(run.sessionId)) return [409, 'Já existe um disparo em andamento nesta instância']
  return null
}

// Reenvia só para quem não recebeu, no mesmo registro de histórico
const retry = async (userId, runId) => {
  const run = await runs.findRun(userId, runId)
  if (!run) return { error: [404, 'Disparo não encontrado'] }
  const blocker = await findRetryBlocker(userId, run)
  if (blocker) return { error: blocker }
  const storedParts = partsOfRun(run)
  const loaded = await loadRuntimeParts(userId, storedParts)
  if (loaded.missingFile) return { error: [404, `O arquivo "${loaded.missingFile}" deste disparo foi excluído da biblioteca`] }
  const reopened = await runs.reopenRunForRetry(runId)
  if (!reopened) return { error: [409, 'Este disparo ainda está em andamento'] }
  console.log(`[panel] disparo reprocessado run=${runId} sessão=${run.sessionId} pendentes=${reopened.recipients.length} user=${userId}`)
  executeInBackground({
    sessionId: run.sessionId, run: reopened.run, recipients: reopened.recipients, storedParts, runtimeParts: loaded.parts, pacing: pacingOfRun(run)
  })
  publishProgress(run.sessionId, reopened.run)
  return { run: reopened.run }
}

/**
 * Programado → cancela antes do horário. Em andamento → para antes do próximo contato (espera interrompida na hora);
 * quem não recebeu fica pendente e pode ser reprocessado depois.
 * @returns {{ status?: 'canceled' | 'canceling', run?: object, error?: [number, string] }}
 */
const cancel = async (userId, runId) => {
  const run = await runs.findRun(userId, runId)
  if (!run) return { error: [404, 'Disparo não encontrado'] }
  if (run.status === 'scheduled') {
    const canceled = await runs.cancelScheduledRun(runId)
    if (!canceled) return { error: [409, 'O disparo já começou; use Abortar'] }
    publishProgress(run.sessionId, canceled)
    console.log(`[panel] programação cancelada run=${runId} user=${userId}`)
    return { status: 'canceled', run: canceled }
  }
  if (run.status !== 'running') return { error: [409, 'Este disparo não está em andamento'] }
  const controller = activeRuns.get(String(runId))
  if (controller) {
    controller.abort()
    console.log(`[panel] disparo abortado pelo usuário run=${runId} user=${userId}`)
    return { status: 'canceling' }
  }
  // "running" sem executor neste processo (ex.: reinício no meio): só fecha o registro
  const finished = await runs.finishRun(runId, 'canceled', CANCELED_REASON)
  publishProgress(run.sessionId, finished)
  console.warn(`[panel] disparo órfão cancelado run=${runId} user=${userId}`)
  return { status: 'canceled', run: finished }
}

module.exports = { startNow, schedule, startScheduled, retry, cancel, isSessionBusy, failScheduled }
