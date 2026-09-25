const express = require('express')
const rateLimiting = require('express-rate-limit')
const middleware = require('../middleware')
const { panelMaxFileSize } = require('../config')
const { sendErrorResponse } = require('../utils')
const panelController = require('./panelController')
const contactController = require('./contactController')
const conversationController = require('./conversationController')
const fileController = require('./fileController')
const broadcastListController = require('./broadcastListController')
const broadcastController = require('./broadcastController')
const broadcastReportController = require('./broadcastReportController')
const templateController = require('./templateController')

const ONE_MINUTE_MS = 60 * 1000

const perUserLimiter = (max, message) => rateLimiting({
  windowMs: ONE_MINUTE_MS,
  max,
  keyGenerator: (req) => req.user.user_id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: message }
})

// Envio sai pela conta real do WhatsApp: limites por usuário protegem o número de bloqueio por spam
const sendRateLimiter = perUserLimiter(30, 'Muitas mensagens em pouco tempo. Aguarde um minuto.')
const broadcastRateLimiter = perUserLimiter(5, 'Muitos disparos em pouco tempo. Aguarde um minuto.')
const uploadRateLimiter = perUserLimiter(20, 'Muitos envios de arquivo em pouco tempo. Aguarde um minuto.')

const rawFileBody = express.raw({ type: 'application/octet-stream', limit: panelMaxFileSize })

const panelRouter = express.Router()

panelRouter.use(
  middleware.rateLimiter,
  middleware.userAuth,
  middleware.checkAuthEnabled,
  middleware.requireActiveUser
)

const sessionScoped = [middleware.sessionNameValidation, middleware.requireSessionOwnership]
const connectedSession = [...sessionScoped, middleware.sessionValidation]

panelRouter.get('/sessions', panelController.getSessions)
panelRouter.get('/sessions/:sessionId/chats', sessionScoped, panelController.getChats)
panelRouter.get('/sessions/:sessionId/chats/:chatId/messages', sessionScoped, panelController.getMessages)
panelRouter.post('/sessions/:sessionId/chats/:chatId/messages', connectedSession, sendRateLimiter, conversationController.sendMessage)
panelRouter.get('/sessions/:sessionId/numbers/:phone', connectedSession, conversationController.resolveNumber)
// Sem exigir conexão aqui: programar para depois não precisa da instância online agora (envio imediato checa no service)
panelRouter.post('/sessions/:sessionId/broadcasts', sessionScoped, broadcastRateLimiter, broadcastController.startBroadcast)
panelRouter.get('/stream', panelController.streamEvents)

panelRouter.get('/contacts', contactController.getContacts)
panelRouter.post('/contacts', contactController.saveContact)
panelRouter.delete('/contacts/:contactId', contactController.removeContact)

panelRouter.get('/files', fileController.getFiles)
panelRouter.post('/files', uploadRateLimiter, rawFileBody, fileController.uploadFile)
panelRouter.delete('/files/:fileId', fileController.removeFile)

panelRouter.get('/broadcast-lists', broadcastListController.getLists)
panelRouter.post('/broadcast-lists', broadcastListController.saveList)
panelRouter.post('/broadcast-lists/import', uploadRateLimiter, broadcastListController.importList)
panelRouter.get('/broadcast-lists/:listId', broadcastListController.getList)
panelRouter.put('/broadcast-lists/:listId', broadcastListController.saveList)
panelRouter.delete('/broadcast-lists/:listId', broadcastListController.removeList)

panelRouter.get('/templates', templateController.getTemplates)
panelRouter.post('/templates', templateController.saveTemplate)
panelRouter.get('/templates/:templateId', templateController.getTemplate)
panelRouter.put('/templates/:templateId', templateController.saveTemplate)
panelRouter.delete('/templates/:templateId', templateController.removeTemplate)

panelRouter.get('/broadcasts', broadcastController.getRuns)
panelRouter.get('/broadcasts/:runId', broadcastController.getRun)
panelRouter.post('/broadcasts/:runId/retry', broadcastRateLimiter, broadcastController.retryBroadcast)
panelRouter.post('/broadcasts/:runId/cancel', broadcastController.cancelBroadcast)
panelRouter.get('/broadcasts/:runId/report', broadcastReportController.getReport)
panelRouter.get('/broadcasts/:runId/report/recipients', broadcastReportController.getReportRecipients)
panelRouter.get('/broadcasts/:runId/report.csv', broadcastReportController.downloadReportCsv)
panelRouter.post('/broadcasts/:runId/report/refresh', broadcastRateLimiter, broadcastReportController.refreshReport)

// Corpo acima do limite (upload) ou JSON malformado viram resposta clara em vez de 500 genérico
// eslint-disable-next-line n/handle-callback-err
panelRouter.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return sendErrorResponse(res, 413, fileController.tooLargeMessage())
  if (error.type === 'entity.parse.failed') return sendErrorResponse(res, 400, 'Corpo da requisição inválido')
  next(error)
})

module.exports = panelRouter
