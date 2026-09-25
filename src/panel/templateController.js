const { sendErrorResponse } = require('../utils')
const { listTemplates, findTemplate, saveTemplate, deleteTemplate } = require('./templateRepository')
const { parseId, parsePagination, isValidPagination } = require('./validators')

const TEMPLATES_DEFAULT_PER_PAGE = 5
const MAX_NAME_LENGTH = 100
const MAX_TEXT_LENGTH = 4096
const MAX_ATTACHMENTS = 10
const UNIQUE_VIOLATION = '23505'

const SAVE_ERRORS = {
  not_found: [404, 'Modelo não encontrado'],
  foreign_files: [422, 'Algum anexo não está na sua biblioteca']
}

const parseTemplateInput = (body) => {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const rawFileIds = Array.isArray(body?.fileIds) ? body.fileIds : []
  if (!name || name.length > MAX_NAME_LENGTH) return { error: 'Nome é obrigatório (até 100 caracteres)' }
  if (text.length > MAX_TEXT_LENGTH) return { error: `Texto maior que ${MAX_TEXT_LENGTH} caracteres` }
  if (rawFileIds.length > MAX_ATTACHMENTS) return { error: `Máximo de ${MAX_ATTACHMENTS} anexos por modelo` }
  const fileIds = rawFileIds.map((fileId) => parseId(String(fileId)))
  if (fileIds.includes(null)) return { error: 'Anexo inválido' }
  // Ordem importa (é a ordem de envio), mas o mesmo arquivo duas vezes não faz sentido
  if (new Set(fileIds).size !== fileIds.length) return { error: 'O mesmo arquivo foi adicionado duas vezes' }
  if (!text && fileIds.length === 0) return { error: 'Escreva um texto ou adicione ao menos um anexo' }
  return { input: { name, text: text || null, audioAsVoice: body?.audioAsVoice !== false, fileIds } }
}

const getTemplates = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: TEMPLATES_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    res.json({ success: true, data: await listTemplates(req.user.user_id, { ...pagination, search: pagination.search || null }) })
  } catch (error) {
    console.error(`[panel] falha ao listar modelos user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar modelos')
  }
}

const getTemplate = async (req, res) => {
  const templateId = parseId(req.params.templateId)
  if (templateId === null) return sendErrorResponse(res, 422, 'Id de modelo inválido')
  try {
    const template = await findTemplate(req.user.user_id, templateId)
    if (!template) return sendErrorResponse(res, 404, 'Modelo não encontrado')
    res.json({ success: true, data: template })
  } catch (error) {
    console.error(`[panel] falha ao buscar modelo user=${req.user.user_id} id=${templateId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao buscar modelo')
  }
}

// POST cria; PUT /:templateId substitui texto e anexos
const saveTemplateHandler = async (req, res) => {
  const hasId = req.params.templateId !== undefined
  const templateId = hasId ? parseId(req.params.templateId) : null
  if (hasId && templateId === null) return sendErrorResponse(res, 422, 'Id de modelo inválido')
  const { input, error } = parseTemplateInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const result = await saveTemplate(req.user.user_id, { templateId, ...input })
    if (result.error) return sendErrorResponse(res, ...SAVE_ERRORS[result.error])
    console.log(`[panel] modelo ${hasId ? 'atualizado' : 'criado'} user=${req.user.user_id} id=${result.template.id} anexos=${input.fileIds.length}`)
    res.status(hasId ? 200 : 201).json({ success: true, data: result.template })
  } catch (saveError) {
    if (saveError.code === UNIQUE_VIOLATION) return sendErrorResponse(res, 409, 'Já existe um modelo com esse nome')
    console.error(`[panel] falha ao salvar modelo user=${req.user.user_id}:`, saveError)
    sendErrorResponse(res, 500, 'Erro ao salvar modelo')
  }
}

const removeTemplate = async (req, res) => {
  const templateId = parseId(req.params.templateId)
  if (templateId === null) return sendErrorResponse(res, 422, 'Id de modelo inválido')
  try {
    if (!await deleteTemplate(req.user.user_id, templateId)) return sendErrorResponse(res, 404, 'Modelo não encontrado')
    console.log(`[panel] modelo removido user=${req.user.user_id} id=${templateId}`)
    res.json({ success: true })
  } catch (error) {
    console.error(`[panel] falha ao remover modelo user=${req.user.user_id} id=${templateId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover modelo')
  }
}

module.exports = { getTemplates, getTemplate, saveTemplate: saveTemplateHandler, removeTemplate }
