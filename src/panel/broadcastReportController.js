const { reportTimeZone } = require('../config')
const { sendErrorResponse } = require('../utils')
const { findReportSummary, listReportRecipients, listAllReportRecipients, isKnownSituation } = require('./broadcastReportRepository')
const { buildReportCsv, reportFileName } = require('./reportCsv')
const { parseId, parsePagination, isValidPagination } = require('./validators')

const RECIPIENTS_DEFAULT_PER_PAGE = 5

// Todas as rotas do relatório começam validando o id e a posse do disparo
const loadOwnedSummary = async (req, res) => {
  const runId = parseId(req.params.runId)
  if (runId === null) {
    sendErrorResponse(res, 422, 'Id de disparo inválido')
    return null
  }
  const summary = await findReportSummary(req.user.user_id, runId)
  if (!summary) sendErrorResponse(res, 404, 'Disparo não encontrado')
  return summary
}

const getReport = async (req, res) => {
  try {
    const summary = await loadOwnedSummary(req, res)
    if (summary) res.json({ success: true, data: summary })
  } catch (error) {
    console.error(`[panel] falha ao montar relatório user=${req.user.user_id} run=${req.params.runId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao montar relatório')
  }
}

const getReportRecipients = async (req, res) => {
  const pagination = parsePagination(req.query, { defaultPerPage: RECIPIENTS_DEFAULT_PER_PAGE })
  const situation = typeof req.query.situation === 'string' ? req.query.situation : 'all'
  if (!isValidPagination(pagination) || !isKnownSituation(situation)) {
    return sendErrorResponse(res, 422, 'Parâmetros de paginação ou filtro inválidos')
  }
  try {
    const summary = await loadOwnedSummary(req, res)
    if (!summary) return
    const data = await listReportRecipients(summary.id, { page: pagination.page, perPage: pagination.perPage, situation })
    res.json({ success: true, data })
  } catch (error) {
    console.error(`[panel] falha ao listar destinatários user=${req.user.user_id} run=${req.params.runId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar destinatários')
  }
}

const downloadReportCsv = async (req, res) => {
  try {
    const summary = await loadOwnedSummary(req, res)
    if (!summary) return
    const recipients = await listAllReportRecipients(summary.id)
    const fileName = reportFileName(summary)
    console.log(`[panel] relatório exportado user=${req.user.user_id} run=${summary.id} linhas=${recipients.length}`)
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store'
    })
    res.send(buildReportCsv(summary, recipients, reportTimeZone))
  } catch (error) {
    console.error(`[panel] falha ao exportar relatório user=${req.user.user_id} run=${req.params.runId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao exportar relatório')
  }
}

module.exports = { getReport, getReportRecipients, downloadReportCsv }
