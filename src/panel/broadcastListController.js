const { sendErrorResponse } = require('../utils')
const { listBroadcastLists, findBroadcastList, saveBroadcastList, deleteBroadcastList } = require('./broadcastListRepository')
const { parseId, parsePagination, isValidPagination } = require('./validators')

const LISTS_DEFAULT_PER_PAGE = 5
const MAX_LIST_NAME_LENGTH = 100
// Mesmo teto das listas nativas do WhatsApp: acima disso o risco de bloqueio por spam sobe muito
const MAX_LIST_MEMBERS = 256
const UNIQUE_VIOLATION = '23505'

const parseListInput = (body) => {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > MAX_LIST_NAME_LENGTH) return { error: 'Nome é obrigatório (até 100 caracteres)' }
  if (!Array.isArray(body?.contactIds)) return { error: 'Selecione os contatos da lista' }
  const contactIds = [...new Set(body.contactIds.map(String).map(parseId))]
  if (contactIds.includes(null)) return { error: 'Contato inválido na lista' }
  if (contactIds.length === 0) return { error: 'Selecione pelo menos um contato' }
  if (contactIds.length > MAX_LIST_MEMBERS) return { error: `Máximo de ${MAX_LIST_MEMBERS} contatos por lista` }
  return { input: { name, contactIds } }
}

const getLists = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: LISTS_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listBroadcastLists(req.user.user_id, { ...pagination, search: pagination.search || null })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[panel] falha ao listar listas user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar listas de transmissão')
  }
}

const getList = async (req, res) => {
  const listId = parseId(req.params.listId)
  if (listId === null) return sendErrorResponse(res, 422, 'Id de lista inválido')
  try {
    const list = await findBroadcastList(req.user.user_id, listId)
    if (!list) return sendErrorResponse(res, 404, 'Lista não encontrada')
    res.json({ success: true, data: list })
  } catch (error) {
    console.error(`[panel] falha ao buscar lista user=${req.user.user_id} id=${listId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao buscar lista')
  }
}

const SAVE_ERRORS = {
  not_found: [404, 'Lista não encontrada'],
  foreign_contacts: [422, 'Algum contato selecionado não está na sua agenda']
}

// POST cria; PUT /:listId substitui nome e membros
const saveList = async (req, res) => {
  const listId = req.params.listId === undefined ? null : parseId(req.params.listId)
  if (req.params.listId !== undefined && listId === null) return sendErrorResponse(res, 422, 'Id de lista inválido')
  const { input, error } = parseListInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const result = await saveBroadcastList(req.user.user_id, { listId, ...input })
    if (result.error) return sendErrorResponse(res, ...SAVE_ERRORS[result.error])
    console.log(`[panel] lista ${listId ? 'atualizada' : 'criada'} user=${req.user.user_id} id=${result.list.id} membros=${input.contactIds.length}`)
    res.status(listId ? 200 : 201).json({ success: true, data: result.list })
  } catch (saveError) {
    if (saveError.code === UNIQUE_VIOLATION) return sendErrorResponse(res, 409, 'Já existe uma lista com esse nome')
    console.error(`[panel] falha ao salvar lista user=${req.user.user_id}:`, saveError)
    sendErrorResponse(res, 500, 'Erro ao salvar lista')
  }
}

const removeList = async (req, res) => {
  const listId = parseId(req.params.listId)
  if (listId === null) return sendErrorResponse(res, 422, 'Id de lista inválido')
  try {
    if (!await deleteBroadcastList(req.user.user_id, listId)) return sendErrorResponse(res, 404, 'Lista não encontrada')
    console.log(`[panel] lista removida user=${req.user.user_id} id=${listId}`)
    res.json({ success: true })
  } catch (error) {
    console.error(`[panel] falha ao remover lista user=${req.user.user_id} id=${listId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover lista')
  }
}

module.exports = { getLists, getList, saveList, removeList }
