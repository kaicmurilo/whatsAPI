const express = require('express')
const router = express.Router()
const AuthController = require('../controllers/authController')
const { authenticateToken, requireScope, requireAnyScope } = require('../middleware/authMiddleware')

// Swagger documentation
const { authSwagger } = require('../middleware/authMiddleware')
const { apikey } = require('../middleware')

// Criar usuário é administrativo: exige x-api-key (sem API_KEY configurada, segue aberto como as rotas /admin)
router.post('/users', apikey, authSwagger, AuthController.createUser)

// Rotas públicas (não requerem autenticação)
router.post('/authenticate', authSwagger, AuthController.authenticateUser)
router.post('/refresh', authSwagger, AuthController.refreshToken)
router.post('/revoke', authSwagger, AuthController.revokeToken)
router.post('/verify', authSwagger, AuthController.verifyToken)



module.exports = router 