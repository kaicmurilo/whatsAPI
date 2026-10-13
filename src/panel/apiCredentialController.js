const { sendErrorResponse } = require('../utils')
const { isRestrictedCredential } = require('../auth/credentialScope')
const { createApiCredential, listApiCredentials, updateApiCredentialSessions, revokeApiCredential, countOwnedSessions } = require('./apiCredentialRepository')
const { parseBoundedInt, parsePagination, isValidPagination } = require('./validators')

const CREDENTIALS_PER_PAGE = 5
const MAX_NAME_LENGTH = 60
const MAX_RESTRICTED_SESSIONS = 50

const isSessionIdText = (sessionId) => typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 100

const parseCredentialName = (body) => {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return { error: 'Informe o nome da aplicação' }
  if (name.length > MAX_NAME_LENGTH) return { error: `Nome com até ${MAX_NAME_LENGTH} caracteres` }
  return { name }
}

/**
 * Ausente ou null = todas as instâncias. Lista = só essas (sem repetição).
 */
const parseCredentialSessionIds = (body) => {
  const sessionIds = body?.sessionIds
  if (sessionIds === undefined || sessionIds === null) return { sessionIds: null }
  if (!Array.isArray(sessionIds) || !sessionIds.every(isSessionIdText)) return { error: 'Instâncias inválidas' }
  const unique = [...new Set(sessionIds)]
  if (unique.length === 0) return { error: 'Escolha ao menos uma instância ou libere todas' }
  if (unique.length > MAX_RESTRICTED_SESSIONS) return { error: `No máximo ${MAX_RESTRICTED_SESSIONS} instâncias` }
  return { sessionIds: unique }
}

// Chave de aplicação não cria nem revoga chave: só o login do painel gerencia credenciais
const requirePanelLogin = (req, res, next) => {
  if (req.token?.apiCredentialId) return sendErrorResponse(res, 403, 'Credenciais só podem ser gerenciadas pelo painel')
  next()
}

// Fora de /sessions/:sessionId as rotas do painel valem para a conta toda (contatos, listas, Telegram...):
// credencial restrita a instâncias não entra nelas. Rota nova fica bloqueada por padrão.
const SESSION_ROUTE = /^\/sessions\/[^/]+/
const restrictToSessionRoutes = (req, res, next) => {
  if (isRestrictedCredential(req.token) && !SESSION_ROUTE.test(req.path)) {
    return sendErrorResponse(res, 403, 'Credencial restrita a instâncias: use as rotas da instância')
  }
  next()
}

const getApiCredentials = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: CREDENTIALS_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listApiCredentials(req.user.user_id, { ...pagination, search: pagination.search || null })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[panel] falha ao listar credenciais user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar credenciais')
  }
}

const parseCredentialId = (req) => parseBoundedInt(req.params.credentialId, { fallback: null, min: 1, max: Number.MAX_SAFE_INTEGER })

const scopeLabel = (sessionIds) => (sessionIds ? `instancias=${sessionIds.length}` : 'instancias=todas')

const postApiCredential = async (req, res) => {
  const { name, error } = parseCredentialName(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  const { sessionIds, error: sessionError } = parseCredentialSessionIds(req.body)
  if (sessionError) return sendErrorResponse(res, 422, sessionError)
  try {
    if (sessionIds && await countOwnedSessions(req.user.user_id, sessionIds) !== sessionIds.length) {
      return sendErrorResponse(res, 422, 'Alguma instância escolhida não é sua')
    }
    const credential = await createApiCredential(req.user.user_id, name, sessionIds)
    console.log(`[panel] credencial criada user=${req.user.user_id} id=${credential.id} prefixo=${credential.tokenPrefix} ${scopeLabel(sessionIds)}`)
    res.status(201).json({ success: true, data: credential })
  } catch (createError) {
    console.error(`[panel] falha ao criar credencial user=${req.user.user_id}:`, createError)
    sendErrorResponse(res, 500, 'Erro ao criar credencial')
  }
}

// Troca as instâncias liberadas sem trocar a chave: a aplicação continua com a mesma
const putCredentialSessions = async (req, res) => {
  const id = parseCredentialId(req)
  if (id === null) return sendErrorResponse(res, 422, 'Id inválido')
  if (!req.body || !('sessionIds' in req.body)) return sendErrorResponse(res, 422, 'Informe sessionIds: lista de instâncias ou null para todas')
  const { sessionIds, error } = parseCredentialSessionIds(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    if (sessionIds && await countOwnedSessions(req.user.user_id, sessionIds) !== sessionIds.length) {
      return sendErrorResponse(res, 422, 'Alguma instância escolhida não é sua')
    }
    const credential = await updateApiCredentialSessions(req.user.user_id, id, sessionIds)
    if (!credential) return sendErrorResponse(res, 404, 'Credencial não encontrada')
    console.log(`[panel] instâncias da credencial alteradas user=${req.user.user_id} id=${id} ${scopeLabel(sessionIds)}`)
    res.json({ success: true, data: credential })
  } catch (updateError) {
    console.error(`[panel] falha ao alterar credencial user=${req.user.user_id} id=${id}:`, updateError)
    sendErrorResponse(res, 500, 'Erro ao alterar credencial')
  }
}

const deleteApiCredential = async (req, res) => {
  const id = parseCredentialId(req)
  if (id === null) return sendErrorResponse(res, 422, 'Id inválido')
  try {
    const revoked = await revokeApiCredential(req.user.user_id, id)
    if (!revoked) return sendErrorResponse(res, 404, 'Credencial não encontrada')
    console.log(`[panel] credencial revogada user=${req.user.user_id} id=${id}`)
    res.json({ success: true })
  } catch (revokeError) {
    console.error(`[panel] falha ao revogar credencial user=${req.user.user_id} id=${id}:`, revokeError)
    sendErrorResponse(res, 500, 'Erro ao revogar credencial')
  }
}

module.exports = { requirePanelLogin, restrictToSessionRoutes, getApiCredentials, postApiCredential, putCredentialSessions, deleteApiCredential, parseCredentialName, parseCredentialSessionIds }
