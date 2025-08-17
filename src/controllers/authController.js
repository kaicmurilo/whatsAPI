const AuthService = require('../auth/authService')
const { sendErrorResponse, sendSuccessResponse } = require('../utils')

class AuthController {
  // Criar novo cliente
  static async createClient(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Criar novo cliente'
      #swagger.description = 'Cria um novo cliente com credenciais únicas'
      #swagger.requestBody = {
        required: true,
        schema: {
          type: 'object',
          properties: {
            client_name: {
              type: 'string',
              description: 'Nome do cliente',
              example: 'Meu App WhatsApp'
            },
            description: {
              type: 'string',
              description: 'Descrição do cliente',
              example: 'Aplicação para integração com WhatsApp'
            }
          },
          required: ['client_name']
        }
      }
      #swagger.responses[201] = {
        description: 'Cliente criado com sucesso',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    client_id: { type: 'string' },
                    client_name: { type: 'string' },
                    client_secret: { type: 'string' },
                    description: { type: 'string' },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { client_name, description = '' } = req.body

      if (!client_name) {
        return sendErrorResponse(res, 400, 'Nome do cliente é obrigatório')
      }

      const client = await AuthService.createClient(client_name, description)
      
      return sendSuccessResponse(res, 201, 'Cliente criado com sucesso', client)
    } catch (error) {
      console.error('Erro ao criar cliente:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Autenticar cliente e gerar token
  static async authenticate(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Autenticar cliente'
      #swagger.description = 'Autentica um cliente e retorna tokens de acesso'
      #swagger.requestBody = {
        required: true,
        schema: {
          type: 'object',
          properties: {
            client_id: {
              type: 'string',
              description: 'ID do cliente',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            client_secret: {
              type: 'string',
              description: 'Chave secreta do cliente',
              example: '550e8400-e29b-41d4-a716-446655440001'
            },
            scope: {
              type: 'string',
              description: 'Escopo do token (opcional)',
              example: 'read write'
            }
          },
          required: ['client_id', 'client_secret']
        }
      }
      #swagger.responses[200] = {
        description: 'Autenticação bem-sucedida',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    token_type: { type: 'string' },
                    expires_in: { type: 'integer' },
                    scope: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { client_id, client_secret, scope = '' } = req.body

      if (!client_id || !client_secret) {
        return sendErrorResponse(res, 400, 'client_id e client_secret são obrigatórios')
      }

      const authResult = await AuthService.authenticateClient(client_id, client_secret)
      
      if (!authResult.success) {
        return sendErrorResponse(res, 401, authResult.message)
      }

      const tokens = await AuthService.createAccessToken(client_id, scope)
      
      return sendSuccessResponse(res, 200, 'Autenticação bem-sucedida', tokens)
    } catch (error) {
      console.error('Erro na autenticação:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Renovar token
  static async refreshToken(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Renovar token'
      #swagger.description = 'Renova um token de acesso usando refresh token'
      #swagger.requestBody = {
        required: true,
        schema: {
          type: 'object',
          properties: {
            refresh_token: {
              type: 'string',
              description: 'Token de renovação',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          },
          required: ['refresh_token']
        }
      }
      #swagger.responses[200] = {
        description: 'Token renovado com sucesso',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    token_type: { type: 'string' },
                    expires_in: { type: 'integer' },
                    scope: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { refresh_token } = req.body

      if (!refresh_token) {
        return sendErrorResponse(res, 400, 'refresh_token é obrigatório')
      }

      const result = await AuthService.refreshToken(refresh_token)
      
      if (!result.success) {
        return sendErrorResponse(res, 401, result.message)
      }

      return sendSuccessResponse(res, 200, 'Token renovado com sucesso', result)
    } catch (error) {
      console.error('Erro ao renovar token:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Revogar token
  static async revokeToken(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Revogar token'
      #swagger.description = 'Revoga um token de acesso'
      #swagger.requestBody = {
        required: true,
        schema: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              description: 'Token de acesso a ser revogado',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          },
          required: ['access_token']
        }
      }
      #swagger.responses[200] = {
        description: 'Token revogado com sucesso',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    */
    try {
      const { access_token } = req.body

      if (!access_token) {
        return sendErrorResponse(res, 400, 'access_token é obrigatório')
      }

      const revoked = await AuthService.revokeToken(access_token)
      
      if (!revoked) {
        return sendErrorResponse(res, 404, 'Token não encontrado')
      }

      return sendSuccessResponse(res, 200, 'Token revogado com sucesso')
    } catch (error) {
      console.error('Erro ao revogar token:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Listar clientes
  static async listClients(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Listar clientes'
      #swagger.description = 'Lista todos os clientes cadastrados'
      #swagger.responses[200] = {
        description: 'Lista de clientes',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      client_id: { type: 'string' },
                      client_name: { type: 'string' },
                      description: { type: 'string' },
                      is_active: { type: 'boolean' },
                      created_at: { type: 'string' },
                      updated_at: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const clients = await AuthService.getAllClients()
      return sendSuccessResponse(res, 200, 'Clientes listados com sucesso', clients)
    } catch (error) {
      console.error('Erro ao listar clientes:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Obter cliente por ID
  static async getClient(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Obter cliente'
      #swagger.description = 'Obtém informações de um cliente específico'
      #swagger.parameters['clientId'] = {
        in: 'path',
        description: 'ID do cliente',
        required: true,
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
      #swagger.responses[200] = {
        description: 'Informações do cliente',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    client_id: { type: 'string' },
                    client_name: { type: 'string' },
                    description: { type: 'string' },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { clientId } = req.params
      const client = await AuthService.getClientById(clientId)
      
      if (!client) {
        return sendErrorResponse(res, 404, 'Cliente não encontrado')
      }

      return sendSuccessResponse(res, 200, 'Cliente encontrado', client)
    } catch (error) {
      console.error('Erro ao obter cliente:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Atualizar cliente
  static async updateClient(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Atualizar cliente'
      #swagger.description = 'Atualiza informações de um cliente'
      #swagger.parameters['clientId'] = {
        in: 'path',
        description: 'ID do cliente',
        required: true,
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
      #swagger.requestBody = {
        required: true,
        schema: {
          type: 'object',
          properties: {
            client_name: {
              type: 'string',
              description: 'Nome do cliente',
              example: 'Meu App WhatsApp Atualizado'
            },
            description: {
              type: 'string',
              description: 'Descrição do cliente',
              example: 'Aplicação atualizada para integração com WhatsApp'
            },
            is_active: {
              type: 'boolean',
              description: 'Status ativo/inativo',
              example: true
            }
          }
        }
      }
      #swagger.responses[200] = {
        description: 'Cliente atualizado com sucesso',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    client_id: { type: 'string' },
                    client_name: { type: 'string' },
                    description: { type: 'string' },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { clientId } = req.params
      const updates = req.body

      const client = await AuthService.updateClient(clientId, updates)
      
      if (!client) {
        return sendErrorResponse(res, 404, 'Cliente não encontrado')
      }

      return sendSuccessResponse(res, 200, 'Cliente atualizado com sucesso', client)
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Deletar cliente
  static async deleteClient(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Deletar cliente'
      #swagger.description = 'Remove um cliente e todos os seus tokens'
      #swagger.parameters['clientId'] = {
        in: 'path',
        description: 'ID do cliente',
        required: true,
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
      #swagger.responses[200] = {
        description: 'Cliente deletado com sucesso',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    */
    try {
      const { clientId } = req.params
      const client = await AuthService.deleteClient(clientId)
      
      if (!client) {
        return sendErrorResponse(res, 404, 'Cliente não encontrado')
      }

      return sendSuccessResponse(res, 200, 'Cliente deletado com sucesso')
    } catch (error) {
      console.error('Erro ao deletar cliente:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Listar tokens de um cliente
  static async listClientTokens(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Listar tokens do cliente'
      #swagger.description = 'Lista todos os tokens de um cliente específico'
      #swagger.parameters['clientId'] = {
        in: 'path',
        description: 'ID do cliente',
        required: true,
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
      #swagger.responses[200] = {
        description: 'Lista de tokens',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      access_token: { type: 'string' },
                      refresh_token: { type: 'string' },
                      token_type: { type: 'string' },
                      expires_at: { type: 'string' },
                      scope: { type: 'string' },
                      is_revoked: { type: 'boolean' },
                      created_at: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { clientId } = req.params
      const tokens = await AuthService.getClientTokens(clientId)
      return sendSuccessResponse(res, 200, 'Tokens listados com sucesso', tokens)
    } catch (error) {
      console.error('Erro ao listar tokens:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Listar sessões de um cliente
  static async listClientSessions(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Listar sessões do cliente'
      #swagger.description = 'Lista todas as sessões WhatsApp de um cliente específico'
      #swagger.parameters['clientId'] = {
        in: 'path',
        description: 'ID do cliente',
        required: true,
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
      #swagger.responses[200] = {
        description: 'Lista de sessões',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      session_id: { type: 'string' },
                      client_id: { type: 'string' },
                      status: { type: 'string' },
                      created_at: { type: 'string' },
                      updated_at: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { clientId } = req.params
      const { query } = require('../database')
      
      const result = await query(
        'SELECT * FROM whatsapp_sessions WHERE client_id = $1 ORDER BY created_at DESC',
        [clientId]
      )
      
      return sendSuccessResponse(res, 200, 'Sessões listadas com sucesso', result.rows)
    } catch (error) {
      console.error('Erro ao listar sessões:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Verificar token
  static async verifyToken(req, res) {
    /*
      #swagger.tags = ['Auth']
      #swagger.summary = 'Verificar token'
      #swagger.description = 'Verifica se um token é válido'
      #swagger.requestBody = {
        required: true,
        schema: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              description: 'Token de acesso a ser verificado',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          },
          required: ['access_token']
        }
      }
      #swagger.responses[200] = {
        description: 'Token válido',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    client: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        client_id: { type: 'string' },
                        client_name: { type: 'string' },
                        description: { type: 'string' },
                        is_active: { type: 'boolean' }
                      }
                    },
                    token: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        access_token: { type: 'string' },
                        expires_at: { type: 'string' },
                        scope: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const { access_token } = req.body

      if (!access_token) {
        return sendErrorResponse(res, 400, 'access_token é obrigatório')
      }

      const result = await AuthService.verifyAccessToken(access_token)
      
      if (!result.success) {
        return sendErrorResponse(res, 401, result.message)
      }

      return sendSuccessResponse(res, 200, 'Token válido', {
        client: result.client,
        token: result.token
      })
    } catch (error) {
      console.error('Erro ao verificar token:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }
}

module.exports = AuthController 