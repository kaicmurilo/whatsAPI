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
  
  // Se já é admin master (verificado por API key), pular verificação de token
  if (req.isMasterAdmin) {
    next()
    return
  }

  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return sendErrorResponse(res, 401, 'Token de acesso não fornecido')
    }

    const result = await AuthService.verifyAccessToken(token)
    
    if (!result.success) {
      return sendErrorResponse(res, 401, result.message)
    }

    // Adicionar informações do cliente e token ao request
    req.client = result.client
    req.token = result.token
    
    next()
  } catch (error) {
    console.error('Erro na autenticação:', error)
    return sendErrorResponse(res, 500, 'Erro interno do servidor')
  }
}

// Middleware para verificar se o cliente está ativo
const requireActiveClient = async (req, res, next) => {
  // Admin master sempre está ativo
  if (req.isMasterAdmin) {
    next()
    return
  }

  if (!req.client || !req.client.is_active) {
    return sendErrorResponse(res, 403, 'Cliente inativo')
  }
  next()
}

// Middleware para verificar escopo específico
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    // Admin master tem todos os escopos
    if (req.isMasterAdmin) {
      next()
      return
    }

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
    // Admin master tem todos os escopos
    if (req.isMasterAdmin) {
      next()
      return
    }

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
    // Admin master tem todos os escopos
    if (req.isMasterAdmin) {
      next()
      return
    }

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

// Middleware para verificar se o cliente é o proprietário da sessão
const requireSessionOwnership = async (req, res, next) => {
  const { sessionId } = req.params
  
  if (!req.client) {
    return sendErrorResponse(res, 401, 'Cliente não autenticado')
  }

  // Admin master pode acessar qualquer sessão
  if (req.isMasterAdmin) {
    try {
      const { query } = require('../database')
      const result = await query(
        'SELECT * FROM whatsapp_sessions WHERE session_id = $1',
        [sessionId]
      )

      if (result.rows.length === 0) {
        // Sessão não existe no banco, mas admin master pode acessar
        req.session = {
          session_id: sessionId,
          client_id: 'admin_master',
          status: 'admin_access'
        }
      } else {
        req.session = result.rows[0]
      }
      next()
      return
    } catch (error) {
      console.error('Erro ao verificar sessão para admin master:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  try {
    const { query } = require('../database')
    const result = await query(
      'SELECT * FROM whatsapp_sessions WHERE session_id = $1 AND client_id = $2',
      [sessionId, req.client.client_id]
    )

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 403, 'Acesso negado: sessão não pertence ao cliente')
    }

    req.session = result.rows[0]
    next()
  } catch (error) {
    console.error('Erro ao verificar propriedade da sessão:', error)
    return sendErrorResponse(res, 500, 'Erro interno do servidor')
  }
}

// Middleware para verificar se a sessão existe e pertence ao cliente (cria se não existir)
const requireSessionOwnershipOrCreate = async (req, res, next) => {
  const { sessionId } = req.params
  
  if (!req.client) {
    return sendErrorResponse(res, 401, 'Cliente não autenticado')
  }

  // Admin master pode acessar qualquer sessão sem criar associação
  if (req.isMasterAdmin) {
    try {
      const { query } = require('../database')
      const result = await query(
        'SELECT * FROM whatsapp_sessions WHERE session_id = $1',
        [sessionId]
      )

      if (result.rows.length === 0) {
        // Sessão não existe no banco, mas admin master pode acessar
        req.session = {
          session_id: sessionId,
          client_id: 'admin_master',
          status: 'admin_access'
        }
      } else {
        req.session = result.rows[0]
      }
      next()
      return
    } catch (error) {
      console.error('Erro ao verificar sessão para admin master:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  try {
    const { query } = require('../database')
    
    // Verificar se a sessão já existe para este cliente
    let result = await query(
      'SELECT * FROM whatsapp_sessions WHERE session_id = $1 AND client_id = $2',
      [sessionId, req.client.client_id]
    )

    if (result.rows.length > 0) {
      // Sessão já existe e pertence ao cliente
      req.session = result.rows[0]
      next()
      return
    }

    // Verificar se a sessão existe para outro cliente
    result = await query(
      'SELECT * FROM whatsapp_sessions WHERE session_id = $1',
      [sessionId]
    )

    if (result.rows.length > 0) {
      // Sessão existe mas pertence a outro cliente
      return sendErrorResponse(res, 403, 'Acesso negado: sessão pertence a outro cliente')
    }

    // Sessão não existe, criar nova associação
    result = await query(
      'INSERT INTO whatsapp_sessions (session_id, client_id, status) VALUES ($1, $2, $3) RETURNING *',
      [sessionId, req.client.client_id, 'creating']
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
  const { enableAuth, globalApiKey } = require('../config')
  
  // Verificar se a API key master foi fornecida
  if (globalApiKey) {
    const apiKey = req.headers['x-api-key']
    if (apiKey && apiKey === globalApiKey) {
      // API key master válida - criar cliente admin master
      req.client = {
        client_id: 'admin_master',
        client_name: 'Administrador Master',
        is_active: true
      }
      req.token = {
        scope: 'read write admin'
      }
      req.isMasterAdmin = true
      next()
      return
    }
  }
  
  if (!enableAuth) {
    // Se a autenticação estiver desabilitada, criar um cliente mock
    req.client = {
      client_id: 'default_client',
      client_name: 'Cliente Padrão',
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
  requireActiveClient,
  requireScope,
  requireAnyScope,
  requireAllScopes,
  requireSessionOwnership,
  requireSessionOwnershipOrCreate,
  checkAuthEnabled,
  authSwagger
} 