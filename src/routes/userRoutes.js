const express = require('express')
const routes = express.Router()
const swaggerUi = require('swagger-ui-express')
const { enableLocalCallbackExample, enableSwaggerEndpoint } = require('./config')
const { getSwaggerConfig, getAvailableLanguages, isLanguageAvailable } = require('../swagger-config')

const middleware = require('./middleware')
const healthController = require('./controllers/healthController')
const sessionController = require('./controllers/sessionController')
const clientController = require('./controllers/clientController')
const chatController = require('./controllers/chatController')
const groupChatController = require('./controllers/groupChatController')
const messageController = require('./controllers/messageController')
const contactController = require('./controllers/contactController')

// Importar rotas de autenticação (apenas rotas públicas)
const authRoutes = require('./routes/authRoutes')

/**
 * ================
 * AUTH ENDPOINTS
 * ================
 */
routes.use('/auth', authRoutes)

/**
 * ================
 * HEALTH ENDPOINTS
 * ================
 */

// API endpoint to check if server is alive
routes.get('/ping', 
  /*
    #swagger.tags = ['Health']
  */
  healthController.healthCheck
)

// Test QR endpoint (no authentication required)
routes.get('/test-qr', 
  /*
    #swagger.tags = ['Health']
  */
  healthController.testQr
)

// Test QR endpoint with authentication
routes.get('/test-qr-auth', 
  /*
    #swagger.tags = ['Health']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  healthController.testQrWithAuth
)

// Cache management endpoints
routes.get('/cache/status', 
  /*
    #swagger.tags = ['Health']
  */
  healthController.cacheStatus
)
routes.post('/cache/clear', 
  /*
    #swagger.tags = ['Health']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  healthController.clearCache
)

// Database status endpoint
routes.get('/database/status', 
  /*
    #swagger.tags = ['Health']
  */
  healthController.databaseStatus
)

// API basic callback
if (enableLocalCallbackExample) {
  routes.post('/localCallbackExample', 
    /*
      #swagger.tags = ['Health']
      #swagger.security = [{
            "bearerAuth": []
      }]
    */
    middleware.checkAuthEnabled,
    middleware.requireActiveUser,
    middleware.rateLimiter, 
    healthController.localCallbackExample
  )
}

/**
 * ================
 * SESSION ENDPOINTS
 * ================
 */
const sessionRouter = express.Router()
sessionRouter.use(middleware.userAuth)
sessionRouter.use(middleware.sessionSwagger)
routes.use('/session', sessionRouter)

// Rotas que requerem autenticação e verificação de propriedade da sessão
sessionRouter.get('/start/:sessionId', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnershipOrCreate,
  middleware.sessionNameValidation, 
  sessionController.startSession
)

sessionRouter.get('/status/:sessionId', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation, 
  sessionController.statusSession
)

sessionRouter.get('/qr/:sessionId', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation, 
  sessionController.sessionQrCode
)

sessionRouter.get('/qr/:sessionId/image', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation, 
  sessionController.sessionQrCodeImage
)

sessionRouter.get('/terminate/:sessionId', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation, 
  sessionController.terminateSession
)

// Rotas administrativas (requerem escopo admin)
sessionRouter.get('/terminateInactive', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireScope('admin'),
  sessionController.terminateInactiveSessions
)

sessionRouter.get('/terminateAll', 
  /*
    #swagger.tags = ['Session']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireScope('admin'),
  sessionController.terminateAllSessions
)

/**
 * ================
 * CLIENT ENDPOINTS
 * ================
 */

const clientRouter = express.Router()
clientRouter.use(middleware.userAuth)
clientRouter.use(middleware.clientSwagger)
routes.use('/client', clientRouter)

// Função para criar middleware de autenticação e verificação de sessão
const createClientMiddleware = (controllerMethod) => [
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation,
  middleware.sessionValidation,
  controllerMethod
]

clientRouter.get('/getClassInfo/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getClassInfo)
)
clientRouter.post('/acceptInvite/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.acceptInvite)
)
clientRouter.post('/archiveChat/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.archiveChat)
)
clientRouter.post('/createGroup/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.createGroup)
)
clientRouter.post('/getBlockedContacts/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getBlockedContacts)
)
clientRouter.post('/getChatById/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getChatById)
)
clientRouter.post('/getChatLabels/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getChatLabels)
)
clientRouter.get('/getChats/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getChats)
)
clientRouter.post('/getChatsByLabelId/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getChatsByLabelId)
)
clientRouter.post('/getCommonGroups/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getCommonGroups)
)
clientRouter.post('/getContactById/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getContactById)
)
clientRouter.get('/getContacts/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getContacts)
)
clientRouter.post('/getInviteInfo/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getInviteInfo)
)
clientRouter.post('/getLabelById/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getLabelById)
)
clientRouter.post('/getLabels/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getLabels)
)
clientRouter.post('/getNumberId/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getNumberId)
)
clientRouter.post('/isRegisteredUser/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.isRegisteredUser)
)
clientRouter.post('/getProfilePicUrl/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getProfilePictureUrl)
)
clientRouter.get('/getState/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  [
    middleware.checkAuthEnabled,
    middleware.requireActiveUser,
    middleware.requireSessionOwnership,
    middleware.sessionNameValidation
  ], 
  clientController.getState
)
clientRouter.post('/markChatUnread/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.markChatUnread)
)
clientRouter.post('/muteChat/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.muteChat)
)
clientRouter.post('/pinChat/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.pinChat)
)
clientRouter.post('/searchMessages/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.searchMessages)
)
clientRouter.post('/sendMessage/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.sendMessage)
)
clientRouter.post('/sendPresenceAvailable/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.sendPresenceAvailable)
)
clientRouter.post('/sendPresenceUnavailable/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.sendPresenceUnavailable)
)
clientRouter.post('/sendSeen/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.sendSeen)
)
clientRouter.post('/setDisplayName/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.setDisplayName)
)
clientRouter.post('/setProfilePicture/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.setProfilePicture)
)
clientRouter.post('/setStatus/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.setStatus)
)
clientRouter.post('/unarchiveChat/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.unarchiveChat)
)
clientRouter.post('/unmuteChat/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.unmuteChat)
)
clientRouter.post('/unpinChat/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.unpinChat)
)
clientRouter.get('/getWWebVersion/:sessionId', 
  /*
    #swagger.tags = ['Client']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createClientMiddleware(clientController.getWWebVersion)
)

/**
 * ================
 * CHAT ENDPOINTS
 * ================
 */
const chatRouter = express.Router()
chatRouter.use(middleware.userAuth)
chatRouter.use(middleware.chatSwagger)
routes.use('/chat', chatRouter)

// Função para criar middleware de autenticação e verificação de sessão
const createChatMiddleware = (controllerMethod) => [
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation,
  middleware.sessionValidation,
  controllerMethod
]

chatRouter.post('/getClassInfo/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.getClassInfo)
)
chatRouter.post('/clearMessages/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.clearMessages)
)
chatRouter.post('/clearState/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.clearState)
)
chatRouter.post('/delete/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.deleteChat)
)
chatRouter.post('/fetchMessages/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.fetchMessages)
)
chatRouter.post('/getContact/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.getContact)
)
chatRouter.post('/sendStateRecording/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.sendStateRecording)
)
chatRouter.post('/sendStateTyping/:sessionId', 
  /*
    #swagger.tags = ['Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createChatMiddleware(chatController.sendStateTyping)
)

/**
 * ================
 * GROUP CHAT ENDPOINTS
 * ================
 */
const groupChatRouter = express.Router()
groupChatRouter.use(middleware.userAuth)
groupChatRouter.use(middleware.groupChatSwagger)
routes.use('/groupChat', groupChatRouter)

// Função para criar middleware de autenticação e verificação de sessão
const createGroupChatMiddleware = (controllerMethod) => [
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation,
  middleware.sessionValidation,
  controllerMethod
]

groupChatRouter.post('/getClassInfo/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.getClassInfo)
)
groupChatRouter.post('/addParticipants/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.addParticipants)
)
groupChatRouter.post('/demoteParticipants/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.demoteParticipants)
)
groupChatRouter.post('/getInviteCode/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.getInviteCode)
)
groupChatRouter.post('/leave/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.leave)
)
groupChatRouter.post('/promoteParticipants/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.promoteParticipants)
)
groupChatRouter.post('/removeParticipants/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.removeParticipants)
)
groupChatRouter.post('/revokeInvite/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.revokeInvite)
)
groupChatRouter.post('/setDescription/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.setDescription)
)
groupChatRouter.post('/setInfoAdminsOnly/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.setInfoAdminsOnly)
)
groupChatRouter.post('/setMessagesAdminsOnly/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.setMessagesAdminsOnly)
)
groupChatRouter.post('/setSubject/:sessionId', 
  /*
    #swagger.tags = ['Group Chat']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createGroupChatMiddleware(groupChatController.setSubject)
)

/**
 * ================
 * MESSAGE ENDPOINTS
 * ================
 */
const messageRouter = express.Router()
messageRouter.use(middleware.userAuth)
messageRouter.use(middleware.messageSwagger)
routes.use('/message', messageRouter)

// Função para criar middleware de autenticação e verificação de sessão
const createMessageMiddleware = (controllerMethod) => [
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation,
  middleware.sessionValidation,
  controllerMethod
]

messageRouter.post('/getClassInfo/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.getClassInfo)
)
messageRouter.post('/delete/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.deleteMessage)
)
messageRouter.post('/downloadMedia/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.downloadMedia)
)
messageRouter.post('/forward/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.forward)
)
messageRouter.post('/getInfo/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.getInfo)
)
messageRouter.post('/getMentions/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.getMentions)
)
messageRouter.post('/getOrder/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.getOrder)
)
messageRouter.post('/getPayment/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.getPayment)
)
messageRouter.post('/getQuotedMessage/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.getQuotedMessage)
)
messageRouter.post('/react/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.react)
)
messageRouter.post('/reply/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.reply)
)
messageRouter.post('/star/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.star)
)
messageRouter.post('/unstar/:sessionId', 
  /*
    #swagger.tags = ['Message']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createMessageMiddleware(messageController.unstar)
)

/**
 * ================
 * CONTACT ENDPOINTS
 * ================
 */
const contactRouter = express.Router()
contactRouter.use(middleware.userAuth)
contactRouter.use(middleware.contactSwagger)
routes.use('/contact', contactRouter)

// Função para criar middleware de autenticação e verificação de sessão
const createContactMiddleware = (controllerMethod) => [
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  middleware.checkAuthEnabled,
  middleware.requireActiveUser,
  middleware.requireSessionOwnership,
  middleware.sessionNameValidation,
  middleware.sessionValidation,
  controllerMethod
]

contactRouter.post('/getClassInfo/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.getClassInfo)
)
contactRouter.post('/block/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.block)
)
contactRouter.post('/getAbout/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.getAbout)
)
contactRouter.post('/getChat/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.getChat)
)
contactRouter.post('/unblock/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.unblock)
)
contactRouter.post('/getFormattedNumber/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.getFormattedNumber)
)
contactRouter.post('/getCountryCode/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.getCountryCode)
)
contactRouter.post('/getProfilePicUrl/:sessionId', 
  /*
    #swagger.tags = ['Contact']
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  createContactMiddleware(contactController.getProfilePicUrl)
)

module.exports = routes 