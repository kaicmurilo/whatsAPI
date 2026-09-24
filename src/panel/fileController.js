const path = require('path')
const { panelMaxFileSize } = require('../config')
const { sendErrorResponse } = require('../utils')
const { listFiles, createFile, deleteOwnedFile } = require('./fileRepository')
const { writeFileBytes, removeFileBytes } = require('./fileStorage')
const { parseBoundedInt, parsePagination, isValidPagination } = require('./validators')

const FILES_DEFAULT_PER_PAGE = 5
const MAX_FILE_NAME_LENGTH = 200
const MIMETYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+$/
const FALLBACK_MIMETYPE = 'application/octet-stream'

// Nome vem URI-encoded no header; fica só o basename, sem caracteres de controle
const parseFileName = (header) => {
  try {
    // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o objetivo
    const name = path.basename(decodeURIComponent(header || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim()
    return name && name.length <= MAX_FILE_NAME_LENGTH ? name : null
  } catch {
    return null
  }
}

const parseMimetype = (header) => {
  const mimetype = (header || '').split(';')[0].trim().toLowerCase()
  return MIMETYPE_PATTERN.test(mimetype) ? mimetype : FALLBACK_MIMETYPE
}

const getFiles = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: FILES_DEFAULT_PER_PAGE })
  if (!isValidPagination(pagination)) return sendErrorResponse(res, 422, 'Parâmetros de paginação ou busca inválidos')
  try {
    const data = await listFiles(req.user.user_id, { ...pagination, search: pagination.search || null })
    res.json({ success: true, data: { ...data, limitBytes: panelMaxFileSize } })
  } catch (error) {
    console.error(`[panel] falha ao listar arquivos user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar arquivos')
  }
}

// Corpo = bytes do arquivo (express.raw, sempre application/octet-stream para o parser JSON global não
// consumir arquivos .json); nome e tipo reais nos headers X-File-Name / X-File-Type
const uploadFile = async (req, res) => {
  const name = parseFileName(req.get('X-File-Name'))
  const bytes = req.body
  if (!name) return sendErrorResponse(res, 422, 'Nome do arquivo ausente ou inválido')
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return sendErrorResponse(res, 422, 'Arquivo vazio')
  let storageKey = null
  try {
    storageKey = await writeFileBytes(bytes)
    const file = await createFile(req.user.user_id, { name, mimetype: parseMimetype(req.get('X-File-Type')), sizeBytes: bytes.length, storageKey })
    console.log(`[panel] arquivo salvo user=${req.user.user_id} id=${file.id} bytes=${bytes.length}`)
    res.status(201).json({ success: true, data: file })
  } catch (error) {
    if (storageKey) await removeFileBytes(storageKey).catch(() => {}) // não deixa bytes órfãos
    console.error(`[panel] falha ao salvar arquivo user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao salvar arquivo')
  }
}

const removeFile = async (req, res) => {
  const fileId = parseBoundedInt(req.params.fileId, { fallback: null, min: 1, max: Number.MAX_SAFE_INTEGER })
  if (fileId === null) return sendErrorResponse(res, 422, 'Id de arquivo inválido')
  try {
    const storageKey = await deleteOwnedFile(req.user.user_id, fileId)
    if (!storageKey) return sendErrorResponse(res, 404, 'Arquivo não encontrado')
    await removeFileBytes(storageKey)
    console.log(`[panel] arquivo removido user=${req.user.user_id} id=${fileId}`)
    res.json({ success: true })
  } catch (error) {
    console.error(`[panel] falha ao remover arquivo user=${req.user.user_id} id=${fileId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover arquivo')
  }
}

const BYTES_PER_MB = 1000000
const tooLargeMessage = () => `Arquivo maior que o limite de ${Math.floor(panelMaxFileSize / BYTES_PER_MB)} MB`

module.exports = { getFiles, uploadFile, removeFile, tooLargeMessage }
