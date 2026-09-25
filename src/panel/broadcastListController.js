const { sendErrorResponse } = require('../utils')
const { listBroadcastLists, findBroadcastList, saveBroadcastList, deleteBroadcastList, importBroadcastList } = require('./broadcastListRepository')
const { buildImportPlan, listNameFromFile } = require('./listImport')
const { parseId, parsePagination, isValidPagination } = require('./validators')

const LISTS_DEFAULT_PER_PAGE = 5
const MAX_LIST_NAME_LENGTH = 100
// Lista é do painel (não é lista nativa do WhatsApp): o envio é individual e com intervalo aleatório.
// O teto só protege o banco e o navegador de listas absurdas.
const MAX_LIST_MEMBERS = 5000
const MAX_IMPORT_ROWS = 5000
const MAX_CELL_LENGTH = 300
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

// Linhas cruas vindas do navegador (a planilha é lida lá); aqui só texto é aceito
const parseImportRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null
  if (rows.length > MAX_IMPORT_ROWS) return null
  const isTextCell = (value) => value === undefined || value === null || (typeof value === 'string' && value.length <= MAX_CELL_LENGTH)
  if (!rows.every((row) => row && isTextCell(row.name) && isTextCell(row.phoneText))) return null
  return rows.map((row) => ({ name: row.name ?? '', phoneText: row.phoneText ?? '' }))
}

const importList = async (req, res) => {
  const userId = req.user.user_id
  const baseName = listNameFromFile(req.body?.fileName)
  const rows = parseImportRows(req.body?.rows)
  if (!baseName) return sendErrorResponse(res, 422, 'Nome do arquivo inválido')
  if (!rows) return sendErrorResponse(res, 422, `Planilha vazia ou com mais de ${MAX_IMPORT_ROWS} linhas`)

  const plan = buildImportPlan(rows)
  if (plan.entries.length === 0) return sendErrorResponse(res, 422, 'Nenhum telefone válido encontrado na planilha')
  if (plan.entries.length > MAX_LIST_MEMBERS) return sendErrorResponse(res, 422, `Máximo de ${MAX_LIST_MEMBERS} contatos por lista`)
  try {
    const result = await importBroadcastList(userId, { baseName, entries: plan.entries })
    console.log(`[panel] lista importada user=${userId} id=${result.list.id} linhas=${rows.length} membros=${result.list.memberCount} novos=${result.createdContacts} reaproveitados=${result.reusedContacts} ignoradas=${plan.skipped.length} repetidos=${plan.duplicates}`)
    res.status(201).json({
      success: true,
      data: { ...result, totalRows: rows.length, duplicates: plan.duplicates, skipped: plan.skipped }
    })
  } catch (importError) {
    console.error(`[panel] falha ao importar lista user=${userId}:`, importError)
    sendErrorResponse(res, 500, 'Erro ao importar a planilha')
  }
}

module.exports = { getLists, getList, saveList, removeList, importList }
