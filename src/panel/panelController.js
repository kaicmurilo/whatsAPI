const AuthService = require('../auth/authService')
const { sessions } = require('../sessions')
const { sendErrorResponse } = require('../utils')
const { listChats, listMessages, isSessionOwnedBy } = require('./messageRepository')
const { findContactNameForChat } = require('./contactRepository')
const { getSessionStatus, subscribePanelEvents } = require('./panelEvents')
const { CHAT_ID_PATTERN, parseBoundedInt, parsePagination, isValidPagination } = require('./validators')

const CHATS_DEFAULT_PER_PAGE = 20
const SSE_HEARTBEAT_MS = 25000

const describeSession = (row) => {
  const client = sessions.get(row.session_id)
  return {
    sessionId: row.session_id,
    status: client ? getSessionStatus(row.session_id) : 'stopped',
    phone: client?.info?.wid?.user || null,
    pushName: client?.info?.pushname || null,
    createdAt: row.created_at
  }
}

const getSessions = async (req, res) => {
  try {
    const rows = await AuthService.getUserSessions(req.user.user_id)
    res.json({ success: true, data: rows.map(describeSession) })
  } catch (error) {
    console.error(`[panel] falha ao listar sessões user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar instâncias')
  }
}

const getChats = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: CHATS_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listChats(req.params.sessionId, req.user.user_id, { ...pagination, search: pagination.search || null })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[panel] falha ao listar chats sessão=${req.params.sessionId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar conversas')
  }
}

const getMessages = async (req, res) => {
  const { sessionId, chatId } = req.params
  const limit = parseBoundedInt(req.query.limit, { fallback: 50, min: 1, max: 200 })
  const beforeId = parseBoundedInt(req.query.beforeId, { fallback: null, min: 1, max: Number.MAX_SAFE_INTEGER })
  if (!CHAT_ID_PATTERN.test(chatId) || limit === null || (req.query.beforeId !== undefined && beforeId === null)) {
    return sendErrorResponse(res, 422, 'Parâmetros inválidos')
  }
  try {
    const [page, contactName] = await Promise.all([
      listMessages(sessionId, chatId, { beforeId, limit }),
      findContactNameForChat(req.user.user_id, chatId)
    ])
    res.json({ success: true, data: { ...page, contactName } })
  } catch (error) {
    console.error(`[panel] falha ao listar mensagens sessão=${sessionId} chat=${chatId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar mensagens')
  }
}

// Cache por conexão: session_id é UNIQUE, então dono de uma sessão não muda enquanto ela existir.
// Guarda a promise (não o valor) para eventos simultâneos da mesma sessão saírem na ordem em que foram publicados.
const createOwnershipCheck = (userId) => {
  const cache = new Map()
  return (sessionId) => {
    if (!cache.has(sessionId)) {
      const lookup = isSessionOwnedBy(sessionId, userId)
      lookup.catch(() => cache.delete(sessionId))
      cache.set(sessionId, lookup)
    }
    return cache.get(sessionId)
  }
}

const streamEvents = (req, res) => {
  const userId = req.user.user_id
  const isOwnSession = createOwnershipCheck(userId)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.write('retry: 3000\n\n')

  const forward = async (event) => {
    try {
      if (await isOwnSession(event.sessionId)) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }
    } catch (error) {
      console.error(`[panel] falha ao encaminhar evento SSE user=${userId}:`, error.message)
    }
  }

  const unsubscribe = subscribePanelEvents(forward)
  const heartbeat = setInterval(() => res.write(': ping\n\n'), SSE_HEARTBEAT_MS)
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
}

module.exports = { getSessions, getChats, getMessages, streamEvents }
