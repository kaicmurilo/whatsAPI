const express = require('express')
const router = express.Router()
const AuthController = require('../controllers/authController')
const { requireScope } = require('../middleware/authMiddleware')

// Middleware para rotas administrativas (apenas API Key)
const adminAuth = async (req, res, next) => {
  /*
    #swagger.security = [{
          "apiKeyAuth": []
    }]
  */
  /* #swagger.responses[403] = {
        description: "Forbidden.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ForbiddenResponse" }
          }
        }
      }
  */
  
  const { globalApiKey } = require('../config')
  if (globalApiKey) {
    const apiKey = req.headers['x-api-key']
    if (!apiKey || apiKey !== globalApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      })
    }
  }
  next()
}

// Swagger documentation para rotas administrativas
const adminSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Admin']
  */
  next()
}

// Rotas administrativas (apenas API Key)
router.get('/users',
  adminAuth,
  adminSwagger,
  AuthController.listUsers
)

router.get('/users/:userId',
  adminAuth,
  adminSwagger,
  AuthController.getUser
)

router.put('/users/:userId',
  adminAuth,
  adminSwagger,
  AuthController.updateUser
)

router.delete('/users/:userId',
  adminAuth,
  adminSwagger,
  AuthController.deleteUser
)

router.get('/users/:userId/tokens',
  adminAuth,
  adminSwagger,
  AuthController.listUserTokens
)

router.get('/users/:userId/sessions',
  adminAuth,
  adminSwagger,
  AuthController.listUserSessions
)

module.exports = router 