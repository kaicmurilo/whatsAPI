const { sendErrorResponse } = require('../utils')
const { parseSessionIds } = require('./broadcastSessions')
const { startContactSync, contactSyncStatus, MAX_SYNC_CONTACTS } = require('./contactSync')

const CONTACT_ID_PATTERN = /^\d{1,18}$/
const MAX_SEARCH_LENGTH = 100

const parseContactScope = (body) => {
  if (body.all === true) {
    const search = typeof body.search === 'string' ? body.search.trim() : ''
    if (search.length > MAX_SEARCH_LENGTH) return { error: 'Busca muito longa' }
    return { contactIds: null, search: search || null }
  }
  const ids = body.contactIds
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_SYNC_CONTACTS) {
    return { error: `Escolha de 1 a ${MAX_SYNC_CONTACTS} contatos` }
  }
  if (!ids.every((id) => typeof id === 'string' && CONTACT_ID_PATTERN.test(id))) return { error: 'Contato inválido' }
  return { contactIds: [...new Set(ids)], search: null }
}

const parseContactSyncInput = (body) => {
  if (!Array.isArray(body?.sessionIds)) return { error: 'Escolha ao menos uma instância' }
  const sessions = parseSessionIds(body.sessionIds)
  if (sessions.error) return { error: sessions.error }
  const scope = parseContactScope(body)
  if (scope.error) return { error: scope.error }
  return {
    input: {
      sessionIds: sessions.sessionIds,
      contactIds: scope.contactIds,
      search: scope.search,
      syncToPhone: body.syncToPhone === true
    }
  }
}

const startWhatsAppSync = async (req, res) => {
  const userId = req.user.user_id
  const { input, error } = parseContactSyncInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const result = await startContactSync(userId, input)
    if (result.error) return sendErrorResponse(res, ...result.error)
    res.status(202).json({ success: true, data: result.job })
  } catch (startError) {
    console.error(`[panel] falha ao iniciar sincronização de contatos user=${userId}:`, startError)
    sendErrorResponse(res, 500, 'Erro ao sincronizar contatos')
  }
}

const getWhatsAppSync = (req, res) => {
  res.json({ success: true, data: contactSyncStatus(req.user.user_id) })
}

module.exports = { startWhatsAppSync, getWhatsAppSync, parseContactSyncInput }
