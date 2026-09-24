const { sendErrorResponse } = require('../utils')
const { listContacts, upsertContact, deleteContact } = require('./contactRepository')
const { normalizePhone, alternatePhone } = require('./phone')
const { parseBoundedInt, parsePagination, isValidPagination } = require('./validators')

const CONTACTS_DEFAULT_PER_PAGE = 5
const MAX_NAME_LENGTH = 100

const parseContactInput = (body) => {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phone = normalizePhone(body?.phone)
  if (!name || name.length > MAX_NAME_LENGTH) return { error: 'Nome é obrigatório (até 100 caracteres)' }
  if (!phone) return { error: 'Telefone inválido: informe DDI + DDD + número (8 a 15 dígitos)' }
  return { contact: { name, phone, phoneAlt: alternatePhone(phone) } }
}

const getContacts = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: CONTACTS_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listContacts(req.user.user_id, { ...pagination, search: pagination.search || null })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[panel] falha ao listar contatos user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar contatos')
  }
}

const saveContact = async (req, res) => {
  const { contact, error } = parseContactInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const { wasCreated, ...saved } = await upsertContact(req.user.user_id, contact)
    console.log(`[panel] contato ${wasCreated ? 'criado' : 'atualizado'} user=${req.user.user_id} id=${saved.id}`)
    res.status(wasCreated ? 201 : 200).json({ success: true, data: saved })
  } catch (saveError) {
    console.error(`[panel] falha ao salvar contato user=${req.user.user_id}:`, saveError)
    sendErrorResponse(res, 500, 'Erro ao salvar contato')
  }
}

const removeContact = async (req, res) => {
  const contactId = parseBoundedInt(req.params.contactId, { fallback: null, min: 1, max: Number.MAX_SAFE_INTEGER })
  if (contactId === null) return sendErrorResponse(res, 422, 'Id de contato inválido')
  try {
    const wasDeleted = await deleteContact(req.user.user_id, contactId)
    if (!wasDeleted) return sendErrorResponse(res, 404, 'Contato não encontrado')
    console.log(`[panel] contato removido user=${req.user.user_id} id=${contactId}`)
    res.json({ success: true })
  } catch (error) {
    console.error(`[panel] falha ao remover contato user=${req.user.user_id} id=${contactId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover contato')
  }
}

module.exports = { getContacts, saveContact, removeContact }
