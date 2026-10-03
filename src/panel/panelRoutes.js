const express = require('express')
const rateLimiting = require('express-rate-limit')
const middleware = require('../middleware')
const { panelMaxFileSize } = require('../config')
const { sendErrorResponse } = require('../utils')
const panelController = require('./panelController')
const contactController = require('./contactController')
const contactSyncController = require('./contactSyncController')
const conversationController = require('./conversationController')
const fileController = require('./fileController')
const broadcastListController = require('./broadcastListController')
const broadcastController = require('./broadcastController')
const broadcastReportController = require('./broadcastReportController')
const templateController = require('./templateController')
const settingsController = require('./settingsController')
const suppressionController = require('./suppressionController')
const metricsController = require('./metricsController')
const telegramController = require('./telegramController')
const broadcastQueueController = require('./broadcastQueueController')

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
// Remover instância: logout no WhatsApp + apaga sessão e mensagens salvas
const instanceRemovalRateLimiter = perUserLimiter(10, 'Muitas remoções de instância. Aguarde um minuto.')
panelRouter.delete('/sessions/:sessionId', sessionScoped, instanceRemovalRateLimiter, panelController.deleteSession)
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
// Salva na conta do WhatsApp em segundo plano; a consulta acompanha o progresso
const contactSyncRateLimiter = perUserLimiter(5, 'Muitas sincronizações em pouco tempo. Aguarde um minuto.')
const contactSyncPollLimiter = perUserLimiter(40, 'Muitas consultas da sincronização. Aguarde um minuto.')
panelRouter.post('/contacts/whatsapp-sync', contactSyncRateLimiter, contactSyncController.startWhatsAppSync)
panelRouter.get('/contacts/whatsapp-sync', contactSyncPollLimiter, contactSyncController.getWhatsAppSync)

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

const settingsRateLimiter = perUserLimiter(30, 'Muitas alterações de configuração. Aguarde um minuto.')
const metricsRateLimiter = perUserLimiter(20, 'Muitas consultas de métricas. Aguarde um minuto.')

panelRouter.get('/metrics', metricsRateLimiter, metricsController.getMetrics)
panelRouter.get('/settings', settingsController.getPanelSettings)
panelRouter.put('/settings', settingsRateLimiter, settingsController.updatePanelSettings)
// Conectar valida o token no Telegram: limite próprio evita usar a API como verificador de tokens
const telegramRateLimiter = perUserLimiter(10, 'Muitas alterações de bots do Telegram. Aguarde um minuto.')
// Bots ("telegram:<id>") e contas ("tguser:<id>") do Telegram são instâncias
// Login de conta pede código ao Telegram: limite estrito evita disparar SMS em série
const telegramLoginRateLimiter = perUserLimiter(5, 'Muitas tentativas de login no Telegram. Aguarde um minuto.')
panelRouter.get('/telegram/instances', telegramController.getTelegramInstances)
panelRouter.post('/telegram/bots', telegramRateLimiter, telegramController.createTelegramBot)
panelRouter.delete('/telegram/bots/:botId', telegramRateLimiter, telegramController.deleteTelegramBot)
panelRouter.post('/telegram/accounts', telegramLoginRateLimiter, telegramController.startTelegramAccountLogin)
panelRouter.post('/telegram/accounts/login/:loginId', telegramLoginRateLimiter, telegramController.continueTelegramAccountLogin)
panelRouter.delete('/telegram/accounts/:accountId', telegramRateLimiter, telegramController.deleteTelegramAccount)
panelRouter.get('/suppression', suppressionController.getSuppressed)
panelRouter.delete('/suppression/:suppressionId', settingsRateLimiter, suppressionController.deleteSuppressed)

const queuePollLimiter = perUserLimiter(40, 'Muitas consultas da fila. Aguarde um minuto.')

// Disparo sem instância do WhatsApp (canal Telegram)
panelRouter.post('/broadcasts', broadcastRateLimiter, broadcastController.startBroadcast)
panelRouter.post('/broadcasts/resume-all', broadcastRateLimiter, broadcastController.resumeAllBroadcasts)
panelRouter.get('/broadcasts/queue', queuePollLimiter, broadcastController.getSendQueue)
// Menu Fila: contatos pendentes dos disparos abertos; remover tira só aquele contato
panelRouter.get('/broadcasts/queue/recipients', broadcastQueueController.getQueuedRecipients)
panelRouter.delete('/broadcasts/:runId/recipients/:position', settingsRateLimiter, broadcastQueueController.deleteQueuedRecipient)
panelRouter.get('/broadcasts', broadcastController.getRuns)
panelRouter.get('/broadcasts/:runId', broadcastController.getRun)
panelRouter.post('/broadcasts/:runId/retry', broadcastRateLimiter, broadcastController.retryBroadcast)
panelRouter.post('/broadcasts/:runId/pause', broadcastController.pauseBroadcast)
panelRouter.post('/broadcasts/:runId/cancel', broadcastController.cancelBroadcast)
panelRouter.put('/broadcasts/:runId/pacing', broadcastController.updateBroadcastPacing)
panelRouter.put('/broadcasts/:runId/sessions', broadcastController.updateBroadcastSessions)
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
