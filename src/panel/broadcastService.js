const { sessions, validateSession } = require('../sessions')
const { findBroadcastList, deleteBroadcastList } = require('./broadcastListRepository')
const runs = require('./broadcastRunRepository')
const { runBroadcast, CANCELED_REASON, PAUSE_REQUEST } = require('./broadcastRunner')
const { createBroadcastGate, canResumeRun } = require('./broadcastGate')
const { findTemplate } = require('./templateRepository')
const { findOwnedFile } = require('./fileRepository')
const { partsFromTemplate, partsFromAdHoc, partsOfRun, trackedPartIndex, loadRuntimeParts } = require('./messageParts')
const { publishPanelEvent, getSessionStatus } = require('./panelEvents')
const { pacingOfRun } = require('./broadcastPacing')
const { sessionsOf, listOwnedSessionIds } = require('./broadcastSessions')

const activeRuns = new Map()

const publishProgress = (sessionId, run) => {
  if (run) publishPanelEvent({ type: 'broadcast_progress', sessionId, run })
}

// Só usa instância realmente conectada (evita tentar enviar em sessão no QR / desconectada)
const getConnectedClient = (sessionId) => {
  if (getSessionStatus(sessionId) !== 'connected') return null
  return sessions.get(sessionId) || null
}

const executeInBackground = ({ sessionIds, run, recipients, storedParts, runtimeParts, pacing }) => {
  const controller = new AbortController()
  const ids = [...sessionIds]
  const runInput = { id: run.id, recipients, parts: runtimeParts, trackedPart: trackedPartIndex(storedParts), pacing, sessionIds: ids, signal: controller.signal }
  const active = { controller, runInput, sessionIds: ids }
  activeRuns.set(String(run.id), active)
  const startedAt = Date.now()
  const primarySessionId = () => ids[0]
  const gate = createBroadcastGate({ userId: run.userId, runId: run.id, createdAt: run.createdAt })
  runBroadcast(runInput, {
    getClient: getConnectedClient,
    recordResult: runs.recordRecipientResult,
    finish: runs.finishRun,
    publish: (progress) => publishProgress(primarySessionId(), progress),
    gate
  })
    .then(() => console.log(`[panel] disparo concluído run=${run.id} sessões=${ids.join(',')} destinatários=${recipients.length} em ${Date.now() - startedAt}ms`))
    .catch((error) => {
      console.error(`[panel] disparo abortado run=${run.id} sessões=${ids.join(',')}:`, error)
      return runs.finishRun(run.id, 'failed', `Erro interno ao registrar o envio: ${error.message}`)
        .then((finished) => publishProgress(primarySessionId(), finished))
        .catch((finishError) => console.error(`[panel] falha ao encerrar disparo run=${run.id}:`, finishError.message))
    })
    .finally(() => {
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
  const sessionIds = input.sessionIds?.length ? input.sessionIds : [sessionId]
  const blocker = await findSessionsBlocker(userId, sessionIds, 'any-connected')
  if (blocker) return { error: blocker }
  const { prepared, error } = await prepareBroadcast(userId, input)
  if (error) return { error }
  const { list, recipients, content, runtimeParts } = prepared
  const { storedParts, ...display } = content
  const run = await runs.createRun(userId, {
    sessionId: sessionIds[0], sessionIds, listId: list.id, listName: list.name, recipients, pacing: input.pacing, parts: storedParts, ...display
  })
  console.log(`[panel] disparo iniciado run=${run.id} sessões=${sessionIds.join(',')} lista=${list.id} total=${recipients.length} partes=${storedParts.length} modelo=${display.templateId ?? '-'} intervalo=${input.pacing.minSeconds}-${input.pacing.maxSeconds}s aleatório=${input.pacing.randomOrder} user=${userId}`)
  executeInBackground({ sessionIds, run, recipients, storedParts, runtimeParts, pacing: input.pacing })
  return { run }
}

// Valida agora (lista/modelo/arquivo existem) para não descobrir o erro só no horário
const schedule = async (userId, sessionId, input, scheduledAt) => {
  const sessionIds = input.sessionIds?.length ? input.sessionIds : [sessionId]
  const blocker = await findSessionsBlocker(userId, sessionIds, 'ownership-only')
  if (blocker) return { error: blocker }
  const { prepared, error } = await prepareBroadcast(userId, input)
  if (error) return { error }
  const { list, content } = prepared
  const run = await runs.createScheduledRun(userId, {
    sessionId: sessionIds[0],
    sessionIds,
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
  console.log(`[panel] disparo programado run=${run.id} sessões=${sessionIds.join(',')} lista=${list.id} para=${scheduledAt.toISOString()} modelo=${content.templateId ?? '-'} user=${userId}`)
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
    const sessionIds = sessionsOf(claimed)
    console.log(`[panel] disparo programado iniciado run=${run.id} sessões=${sessionIds.join(',')} total=${recipients.length}`)
    publishProgress(sessionIds[0], populated)
    executeInBackground({ sessionIds, run: populated, recipients, storedParts: content.storedParts, runtimeParts, pacing: pacingOfRun(claimed) })
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
  const resendable = new Set(['failed', 'pending', 'awaiting_reply'])
  if (!run.recipients.some((recipient) => resendable.has(recipient.status))) {
    return [422, 'Não há contatos pendentes para reenviar']
  }
  return findSessionsBlocker(userId, sessionsOf(run), 'any-connected')
}

/**
 * @param {'all-connected' | 'any-connected' | 'ownership-only'} mode
 * all-connected: cada número escolhido está online
 * any-connected: envio agora e retomar — segue com quem estiver online; desconectada fica no rodízio e entra quando voltar
 * ownership-only: programar ou trocar instâncias — a conexão é checada na hora de enviar
 */
const findSessionsBlocker = async (userId, sessionIds, mode) => {
  if (sessionIds.length === 0) return [422, 'Escolha ao menos uma instância']
  const owned = await listOwnedSessionIds(userId, sessionIds)
  if (sessionIds.some((sessionId) => !owned.has(sessionId))) return [403, 'Uma das instâncias não pertence a você']
  if (mode === 'ownership-only') return null
  let connectedCount = 0
  for (const sessionId of sessionIds) {
    const connected = (await validateSession(sessionId)).success
    if (connected) connectedCount += 1
    else if (mode === 'all-connected') return [409, 'Todas as instâncias selecionadas precisam estar conectadas']
  }
  if (connectedCount === 0) return [409, 'Nenhuma das instâncias selecionadas está conectada']
  return null
}

// Mesmas partes do disparo original, com a mídia carregada da biblioteca
const loadPartsOfRun = async (userId, run) => {
  const storedParts = partsOfRun(run)
  const loaded = await loadRuntimeParts(userId, storedParts)
  if (loaded.missingFile) return { error: [404, `O arquivo "${loaded.missingFile}" deste disparo foi excluído da biblioteca`] }
  return { storedParts, runtimeParts: loaded.parts }
}

// Reenvia só para quem não recebeu (falhas + pendentes), no mesmo registro de histórico.
// É também o "Retomar" de um pausado: quem já recebeu nunca recebe de novo.
const retry = async (userId, runId) => {
  const run = await runs.findRun(userId, runId)
  if (!run) return { error: [404, 'Disparo não encontrado'] }
  const blocker = await findRetryBlocker(userId, run)
  if (blocker) return { error: blocker }
  const { storedParts, runtimeParts, error } = await loadPartsOfRun(userId, run)
  if (error) return { error }
  const reopened = await runs.reopenRunForRetry(runId)
  if (!reopened) return { error: [409, 'Este disparo ainda está em andamento'] }
  const sessionIds = sessionsOf(reopened.run)
  console.log(`[panel] disparo reprocessado run=${runId} sessões=${sessionIds.join(',')} pendentes=${reopened.recipients.length} user=${userId}`)
  executeInBackground({ sessionIds, run: reopened.run, recipients: reopened.recipients, storedParts, runtimeParts, pacing: pacingOfRun(run) })
  publishProgress(sessionIds[0], reopened.run)
  return { run: reopened.run }
}

// Para antes do próximo contato; quem não recebeu fica pendente para Retomar
const pause = async (userId, runId) => {
  const run = await runs.findRun(userId, runId)
  if (!run) return { error: [404, 'Disparo não encontrado'] }
  const controller = run.status === 'running' ? activeRuns.get(String(runId))?.controller : null
  if (!controller) return { error: [409, 'Este disparo não está em andamento'] }
  controller.abort(PAUSE_REQUEST)
  console.log(`[panel] disparo pausado pelo usuário run=${runId} user=${userId}`)
  return { status: 'pausing' }
}

/**
 * Troca o intervalo entre envios. Em andamento: vale a partir da próxima espera
 * (a ordem já foi sorteada no início; "ordem aleatória" passa a valer no próximo Retomar/Reprocessar).
 */
const changePacing = async (userId, runId, pacing) => {
  const run = await runs.findRun(userId, runId)
  if (!run) return { error: [404, 'Disparo não encontrado'] }
  const updated = await runs.updateRunPacing(runId, pacing)
  const active = activeRuns.get(String(runId))
  // ponytail: troca o objeto lido pelo runner a cada espera — estado em memória, uma réplica
  if (active) active.runInput.pacing = pacing
  publishProgress(run.sessionId, updated)
  console.log(`[panel] ritmo alterado run=${runId} intervalo=${pacing.minSeconds}-${pacing.maxSeconds}s aleatório=${pacing.randomOrder} aoVivo=${Boolean(active)} user=${userId}`)
  return { run: updated }
}

/**
 * Troca as instâncias do rodízio. Em andamento: vale a partir do próximo contato.
 * A escolha do próximo envio é quem tem menos mensagens no dia, entre as marcadas.
 */
const changeSessions = async (userId, runId, sessionIds) => {
  const run = await runs.findRun(userId, runId)
  if (!run) return { error: [404, 'Disparo não encontrado'] }
  const blocker = await findSessionsBlocker(userId, sessionIds, 'ownership-only')
  if (blocker) return { error: blocker }
  const updated = await runs.updateRunSessions(runId, sessionIds)
  if (!updated) return { error: [404, 'Disparo não encontrado'] }
  const active = activeRuns.get(String(runId))
  if (active) active.sessionIds.splice(0, active.sessionIds.length, ...sessionIds)
  publishProgress(sessionIds[0], updated)
  console.log(`[panel] instâncias alteradas run=${runId} sessões=${sessionIds.join(',')} aoVivo=${Boolean(active)} user=${userId}`)
  return { run: updated }
}

/**
 * Programado → cancela antes do horário. Pausado → fecha. Em andamento → para antes do próximo contato (espera interrompida na hora);
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
  if (run.status === 'paused' || run.status === 'interrupted') {
    const canceled = await runs.cancelStoppedRun(runId, CANCELED_REASON, run.status)
    if (!canceled) return { error: [409, 'O disparo foi retomado; use Abortar'] }
    publishProgress(run.sessionId, canceled)
    console.log(`[panel] disparo encerrado run=${runId} status=${run.status} user=${userId}`)
    return { status: 'canceled', run: canceled }
  }
  if (run.status === 'awaiting') {
    const canceled = await runs.cancelAwaitingRun(runId, CANCELED_REASON)
    if (!canceled) return { error: [409, 'O disparo já foi concluído'] }
    publishProgress(run.sessionId, canceled)
    console.log(`[panel] disparo aguardando respostas cancelado run=${runId} user=${userId}`)
    return { status: 'canceled', run: canceled }
  }
  if (run.status !== 'running') return { error: [409, 'Este disparo não está em andamento'] }
  const controller = activeRuns.get(String(runId))?.controller
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

// Para o envio antes do próximo contato e apaga a lista com o histórico dela.
const discardList = async (userId, listId) => {
  const list = await findBroadcastList(userId, listId)
  if (!list) return { error: [404, 'Lista não encontrada'] }
  const runIds = await runs.listRunIdsByList(userId, listId)
  for (const runId of runIds) {
    const active = activeRuns.get(String(runId))
    if (!active) continue
    active.controller.abort()
    activeRuns.delete(String(runId))
  }
  const removedRuns = await runs.deleteRunsByList(userId, listId)
  const deleted = await deleteBroadcastList(userId, listId)
  if (!deleted) return { error: [404, 'Lista não encontrada'] }
  console.log(`[panel] lista excluída user=${userId} id=${listId} disparos=${removedRuns}`)
  return { deleted: true }
}

// Interrompido, pausa do usuário, instância caída ou falhas seguidas. Horário e teto diário retomam sozinhos.
const resumeAll = async (userId) => {
  const runIds = await runs.listManualResumeRunIds(userId)
  const resumed = []
  const skipped = []
  for (const runId of runIds) {
    try {
      const result = await retry(userId, runId)
      if (result.error) skipped.push({ id: String(runId), error: result.error[1] })
      else resumed.push(result.run)
    } catch (error) {
      console.error(`[panel] falha ao retomar em lote run=${runId} user=${userId}:`, error)
      skipped.push({ id: String(runId), error: 'Erro ao retomar' })
    }
  }
  console.log(`[panel] retomar todas user=${userId} retomados=${resumed.length} ignorados=${skipped.length}`)
  return { resumed, skipped }
}

const resumePolicyPause = async (run) => {
  if (activeRuns.has(String(run.id))) return
  if (!(await canResumeRun(run, new Date()))) return
  const sessionIds = sessionsOf(run)
  let connected = false
  for (const sessionId of sessionIds) {
    if ((await validateSession(sessionId)).success) connected = true
  }
  if (!connected) return
  const claimed = await runs.claimPausedForResume(run.id)
  if (!claimed) return
  if (claimed.recipients.length === 0) {
    publishProgress(sessionIds[0], claimed.run)
    return
  }
  try {
    const { storedParts, runtimeParts, error } = await loadPartsOfRun(run.userId, claimed.run)
    if (error) {
      const finished = await runs.finishRun(run.id, 'failed', error[1])
      publishProgress(sessionIds[0], finished)
      return
    }
    console.log(`[panel] disparo retomado pela política run=${run.id} pendentes=${claimed.recipients.length}`)
    executeInBackground({
      sessionIds, run: claimed.run, recipients: claimed.recipients, storedParts, runtimeParts, pacing: pacingOfRun(claimed.run)
    })
    publishProgress(sessionIds[0], claimed.run)
  } catch (error) {
    const finished = await runs.finishRun(run.id, 'failed', `Erro ao retomar: ${error.message}`)
    publishProgress(sessionIds[0], finished)
  }
}

module.exports = { startNow, schedule, startScheduled, retry, pause, cancel, changePacing, changeSessions, failScheduled, resumePolicyPause, discardList, resumeAll }
