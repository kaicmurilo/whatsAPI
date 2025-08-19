const express = require('express')
const router = express.Router()
const AuthController = require('../controllers/authController')
const { authenticateToken, requireScope, requireAnyScope } = require('../middleware/authMiddleware')

// Swagger documentation
const { authSwagger } = require('../middleware/authMiddleware')

// Rotas públicas (não requerem autenticação)
router.post('/users', authSwagger, AuthController.createUser)
router.post('/authenticate', authSwagger, AuthController.authenticateUser)
router.post('/refresh', authSwagger, AuthController.refreshToken)
router.post('/revoke', authSwagger, AuthController.revokeToken)
router.post('/verify', authSwagger, AuthController.verifyToken)



module.exports = router 