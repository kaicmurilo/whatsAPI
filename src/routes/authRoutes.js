const express = require('express')
const AuthController = require('../controllers/authController')
const { 
  authenticateToken, 
  requireActiveClient, 
  requireScope,
  authSwagger 
} = require('../middleware/authMiddleware')

const router = express.Router()

// Rotas públicas (não requerem autenticação)
router.post('/clients', authSwagger, AuthController.createClient)
router.post('/authenticate', authSwagger, AuthController.authenticate)
router.post('/refresh', authSwagger, AuthController.refreshToken)
router.post('/revoke', authSwagger, AuthController.revokeToken)
router.post('/verify', authSwagger, AuthController.verifyToken)

// Rotas protegidas (requerem autenticação)
router.get('/clients', 
  authSwagger, 
  authenticateToken, 
  requireActiveClient, 
  requireScope('admin'), 
  AuthController.listClients
)

router.get('/clients/:clientId', 
  authSwagger, 
  authenticateToken, 
  requireActiveClient, 
  requireScope('admin'), 
  AuthController.getClient
)

router.put('/clients/:clientId', 
  authSwagger, 
  authenticateToken, 
  requireActiveClient, 
  requireScope('admin'), 
  AuthController.updateClient
)

router.delete('/clients/:clientId', 
  authSwagger, 
  authenticateToken, 
  requireActiveClient, 
  requireScope('admin'), 
  AuthController.deleteClient
)

router.get('/clients/:clientId/tokens', 
  authSwagger, 
  authenticateToken, 
  requireActiveClient, 
  requireScope('admin'), 
  AuthController.listClientTokens
)

router.get('/clients/:clientId/sessions', 
  authSwagger, 
  authenticateToken, 
  requireActiveClient, 
  requireScope('admin'), 
  AuthController.listClientSessions
)

module.exports = router 