const AuthService = require('../auth/authService')
const { sendErrorResponse } = require('../utils')

// Middleware para verificar token de acesso
const authenticateToken = async (req, res, next) => {
  /*
    #swagger.security = [{
          "bearerAuth": []
    }]
  */
  /* #swagger.responses[401] = {
        description: "Unauthorized.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/UnauthorizedResponse" }
          }
        }
      }
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

  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return sendErrorResponse(res, 401, 'Token de acesso não fornecido')
    }

    const result = await AuthService.validateToken(token)
    
    if (!result) {
      return sendErrorResponse(res, 401, 'Token inválido ou expirado')
    }

    // Adicionar informações do usuário e token ao request
    req.user = result.user
    req.token = result.token
    
    next()
  } catch (error) {
    console.error('Erro na autenticação:', error)
    return sendErrorResponse(res, 500, 'Erro interno do servidor')
  }
}

// Middleware para verificar se o usuário está ativo
const requireActiveUser = async (req, res, next) => {
  if (!req.user || !req.user.is_active) {
    return sendErrorResponse(res, 403, 'Usuário inativo')
  }
  next()
}

// Middleware para verificar escopo específico
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.token || !req.token.scope) {
      return sendErrorResponse(res, 403, 'Escopo não definido')
    }

    const clientScopes = req.token.scope.split(' ')
    if (!clientScopes.includes(requiredScope)) {
      return sendErrorResponse(res, 403, `Escopo '${requiredScope}' é necessário`)
    }

    next()
  }
}

// Middleware para verificar múltiplos escopos (qualquer um)
const requireAnyScope = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.token || !req.token.scope) {
      return sendErrorResponse(res, 403, 'Escopo não definido')
    }

    const clientScopes = req.token.scope.split(' ')
    const hasAnyScope = requiredScopes.some(scope => clientScopes.includes(scope))
    
    if (!hasAnyScope) {
      return sendErrorResponse(res, 403, `Um dos escopos [${requiredScopes.join(', ')}] é necessário`)
    }

    next()
  }
}

// Middleware para verificar múltiplos escopos (todos)
const requireAllScopes = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.token || !req.token.scope) {
      return sendErrorResponse(res, 403, 'Escopo não definido')
    }

    const clientScopes = req.token.scope.split(' ')
    const hasAllScopes = requiredScopes.every(scope => clientScopes.includes(scope))
    
    if (!hasAllScopes) {
      return sendErrorResponse(res, 403, `Todos os escopos [${requiredScopes.join(', ')}] são necessários`)
    }

    next()
  }
}

// Middleware para verificar se o usuário é o proprietário da sessão
const requireSessionOwnership = async (req, res, next) => {
  const { sessionId } = req.params
  
  if (!req.user) {
    return sendErrorResponse(res, 401, 'Usuário não autenticado')
  }

  try {
    const { query } = require('../database')
    const result = await query(
      'SELECT * FROM whatsapp_sessions WHERE session_id = $1 AND user_id = $2',
      [sessionId, req.user.user_id]
    )

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 403, 'Acesso negado: sessão não pertence ao usuário')
    }

    req.session = result.rows[0]
    next()
  } catch (error) {
    console.error('Erro ao verificar propriedade da sessão:', error)
    return sendErrorResponse(res, 500, 'Erro interno do servidor')
  }
}

// Middleware para verificar se a sessão existe e pertence ao usuário (cria se não existir)
const requireSessionOwnershipOrCreate = async (req, res, next) => {
  const { sessionId } = req.params
  
  if (!req.user) {
    return sendErrorResponse(res, 401, 'Usuário não autenticado')
  }

  try {
    const { query } = require('../database')
    
    // Verificar se a sessão já existe para este usuário
    let result = await query(
      'SELECT * FROM whatsapp_sessions WHERE session_id = $1 AND user_id = $2',
      [sessionId, req.user.user_id]
    )

    if (result.rows.length > 0) {
      // Sessão já existe e pertence ao usuário
      req.session = result.rows[0]
      next()
      return
    }

    // Verificar se a sessão existe para outro usuário
    result = await query(
      'SELECT * FROM whatsapp_sessions WHERE session_id = $1',
      [sessionId]
    )

    if (result.rows.length > 0) {
      // Sessão existe mas pertence a outro usuário
      return sendErrorResponse(res, 403, 'Acesso negado: sessão pertence a outro usuário')
    }

    // Sessão não existe, criar nova associação
    result = await query(
      'INSERT INTO whatsapp_sessions (session_id, user_id, status) VALUES ($1, $2, $3) RETURNING *',
      [sessionId, req.user.user_id, 'creating']
    )

    req.session = result.rows[0]
    next()
  } catch (error) {
    console.error('Erro ao verificar/criar propriedade da sessão:', error)
    return sendErrorResponse(res, 500, 'Erro interno do servidor')
  }
}

// Middleware para verificar se a autenticação está habilitada
const checkAuthEnabled = (req, res, next) => {
  const { enableAuth } = require('../config')
  
  if (!enableAuth) {
    // Se a autenticação estiver desabilitada, criar um usuário mock
    req.user = {
      user_id: 'default_user',
      user_name: 'Usuário Padrão',
      is_active: true
    }
    req.token = {
      scope: 'read write admin'
    }
  }
  
  next()
}

// Middleware para Swagger - Auth
const authSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Auth']
  */
  next()
}

module.exports = {
  authenticateToken,
  requireActiveUser,
  requireScope,
  requireAnyScope,
  requireAllScopes,
  requireSessionOwnership,
  requireSessionOwnershipOrCreate,
  checkAuthEnabled,
  authSwagger
} 