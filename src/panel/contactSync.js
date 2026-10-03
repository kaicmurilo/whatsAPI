const { listOwnedSessionIds } = require('./broadcastSessions')
const { getConnectedClient } = require('./broadcastService')
const { pickDelayMs, waitOrAbort } = require('./broadcastRunner')
const { listContactsForSync } = require('./contactRepository')
const { splitName } = require('./whatsappContact')
const { alternatePhone } = require('./phone')

const MAX_SYNC_CONTACTS = 5000
// Salvar milhares de contatos de uma vez também é sinal de automação: cada instância salva um por vez, com pausa.
// Instâncias diferentes rodam em paralelo: o ritmo por conta não muda, só o tempo total cai.
const SYNC_PACING = { minSeconds: 1, maxSeconds: 3 }
const MAX_ERRORS_KEPT = 5
const NO_CONNECTED_SESSION = 'Nenhuma instância escolhida está conectada'

// userId → última sincronização (em memória: some no reinício, como o progresso de um disparo)
const jobs = new Map()

const describeError = (error) => (typeof error === 'string' ? error : error?.message || 'erro desconhecido').slice(0, 200)

const recordFailure = (job, contact, sessionId, reason) => {
  job.failed += 1
  job.errors = [...job.errors, { name: contact.name, sessionId, error: reason }].slice(-MAX_ERRORS_KEPT)
}

// Contatos já salvos na conta, numa leitura só. Se a leitura falhar, nada é pulado (salva todos).
const readSavedPhones = async (client) => {
  try {
    const phones = await client.pupPage.evaluate(() => {
      const { getIsMyContact } = window.require('WAWebFrontendContactGetters')
      return window.require('WAWebCollections').Contact.getModelsArray()
        .filter((contact) => getIsMyContact(contact))
        .map((contact) => contact.phoneNumber?.user || (contact.id?.server === 'c.us' ? contact.id.user : null))
        .filter(Boolean)
    })
    return new Set(phones)
  } catch (error) {
    console.warn(`[panel] não leu os contatos já salvos; salvando todos: ${describeError(error)}`)
    return new Set()
  }
}

const isAlreadySaved = (savedPhones, phone) => savedPhones.has(phone) || savedPhones.has(alternatePhone(phone))

// Instância caiu: o que faltava nela conta como falha e o trabalhador dela para
const giveUpOnSession = (job, contacts, fromIndex, sessionId) => {
  const remaining = contacts.length - fromIndex
  job.failed += remaining
  job.processed += remaining
  job.lostSessions = [...job.lostSessions, sessionId]
  job.errors = [...job.errors, { name: contacts[fromIndex].name, sessionId, error: `instância desconectada; ${remaining} contato(s) não salvos nela` }].slice(-MAX_ERRORS_KEPT)
}

const syncOnSession = async (job, contacts, sessionId, { getClient, pause, readSaved }) => {
  const firstClient = getClient(sessionId)
  if (!firstClient) return giveUpOnSession(job, contacts, 0, sessionId)
  const savedPhones = await readSaved(firstClient)
  let hasSaved = false
  for (const [index, contact] of contacts.entries()) {
    if (isAlreadySaved(savedPhones, contact.phone)) {
      job.skipped += 1
      job.processed += 1
      continue
    }
    if (hasSaved) await pause()
    const client = getClient(sessionId)
    if (!client) return giveUpOnSession(job, contacts, index, sessionId)
    const { firstName, lastName } = splitName(contact.name)
    try {
      await client.saveOrEditAddressbookContact(contact.phone, firstName, lastName, job.syncToPhone)
      job.saved += 1
    } catch (error) {
      recordFailure(job, contact, sessionId, describeError(error))
    }
    hasSaved = true
    job.processed += 1
  }
}

/**
 * Salva cada contato em todas as instâncias escolhidas: um trabalhador por instância, em paralelo.
 * Pula quem já está salvo na conta. Falha num contato não interrompe os demais; instância que cai
 * para só o trabalhador dela.
 */
const syncContacts = async (job, contacts, { getClient, pause, readSaved = readSavedPhones }) => {
  await Promise.all(job.sessionIds.map((sessionId) => syncOnSession(job, contacts, sessionId, { getClient, pause, readSaved })))
  if (job.lostSessions.length === job.sessionIds.length) {
    job.status = 'stopped'
    job.error = NO_CONNECTED_SESSION
  } else {
    job.status = 'done'
    if (job.lostSessions.length > 0) job.error = `Caiu no meio: ${job.lostSessions.join(', ')}`
  }
  job.finishedAt = new Date().toISOString()
}

const snapshotOf = (job) => ({ ...job, sessionIds: [...job.sessionIds], lostSessions: [...job.lostSessions], errors: [...job.errors] })

const newJob = ({ sessionIds, syncToPhone }) => ({
  status: 'running',
  sessionIds,
  syncToPhone,
  contacts: 0,
  total: 0,
  processed: 0,
  saved: 0,
  skipped: 0,
  failed: 0,
  lostSessions: [],
  errors: [],
  error: null,
  startedAt: new Date().toISOString(),
  finishedAt: null
})

const loadSyncTargets = async (userId, { sessionIds, contactIds, search }) => {
  const owned = await listOwnedSessionIds(userId, sessionIds)
  if (owned.size !== sessionIds.length) return { error: [403, 'Instância não pertence a esta conta'] }
  if (!sessionIds.some((sessionId) => getConnectedClient(sessionId))) return { error: [409, NO_CONNECTED_SESSION] }
  const contacts = await listContactsForSync(userId, { contactIds, search, limit: MAX_SYNC_CONTACTS })
  if (contacts.length === 0) return { error: [422, 'Nenhum contato para sincronizar'] }
  return { contacts }
}

const runInBackground = (userId, job, contacts) => {
  const pause = () => waitOrAbort(pickDelayMs(SYNC_PACING))
  syncContacts(job, contacts, { getClient: getConnectedClient, pause })
    .then(() => {
      console.log(`[panel] contatos sincronizados user=${userId} status=${job.status} salvamentos=${job.processed}/${job.total} salvos=${job.saved} jaSalvos=${job.skipped} falhas=${job.failed}`)
    })
    .catch((error) => {
      job.status = 'failed'
      job.error = describeError(error)
      job.finishedAt = new Date().toISOString()
      console.error(`[panel] falha ao sincronizar contatos user=${userId}:`, error)
    })
}

const startContactSync = async (userId, input) => {
  if (jobs.get(userId)?.status === 'running') return { error: [409, 'Já existe uma sincronização em andamento'] }
  const previous = jobs.get(userId)
  const job = newJob(input)
  jobs.set(userId, job) // reserva antes dos awaits: dois cliques não abrem duas sincronizações
  try {
    const { contacts, error } = await loadSyncTargets(userId, input)
    if (error) {
      restoreJob(userId, previous)
      return { error }
    }
    job.contacts = contacts.length
    job.total = contacts.length * input.sessionIds.length // um salvamento por contato em cada instância
    console.log(`[panel] sincronizando contatos com o WhatsApp user=${userId} contatos=${contacts.length} instâncias=${input.sessionIds.join(',')} agendaCelular=${input.syncToPhone}`)
    runInBackground(userId, job, contacts)
    return { job: snapshotOf(job) }
  } catch (error) {
    restoreJob(userId, previous)
    throw error
  }
}

const restoreJob = (userId, previous) => {
  if (previous) jobs.set(userId, previous)
  else jobs.delete(userId)
}

const contactSyncStatus = (userId) => {
  const job = jobs.get(userId)
  return job ? snapshotOf(job) : null
}

module.exports = { startContactSync, contactSyncStatus, syncContacts, splitName, MAX_SYNC_CONTACTS }
