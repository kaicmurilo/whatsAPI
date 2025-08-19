const AuthService = require('../auth/authService')
const { sendErrorResponse, sendSuccessResponse } = require('../utils')

class AuthController {
  // Criar usuário
  static async createUser(req, res) {
    // #swagger.summary = 'Criar novo usuário'
    // #swagger.description = 'Cria um novo usuário no sistema com credenciais únicas. Esta rota é pública e não requer autenticação.'
    // #swagger.requestBody = {
    //   required: true,
    //   content: {
    //     "application/json": {
    //       schema: {
    //         type: "object",
    //         required: ["user_name"],
    //         properties: {
    //           user_name: {
    //             type: "string",
    //             description: "Nome do usuário",
    //             example: "Meu App WhatsApp"
    //           },
    //           user_documento_identificacao: {
    //             type: "string",
    //             description: "Documento de identificação (CPF, CNPJ, etc.)",
    //             example: "123.456.789-00"
    //           },
    //           description: {
    //             type: "string",
    //             description: "Descrição opcional do usuário",
    //             example: "Aplicação para integração com WhatsApp"
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
    try {
      const { user_name, description, user_documento_identificacao } = req.body

      if (!user_name) {
        return sendErrorResponse(res, 400, 'Nome do usuário é obrigatório')
      }

      const user = await AuthService.createUser(user_name, description, user_documento_identificacao)

      return sendSuccessResponse(res, 201, 'Usuário criado com sucesso', {
        id: user.id,
        user_id: user.user_id,
        user_name: user.user_name,
        user_documento_identificacao: user.user_documento_identificacao,
        description: user.description,
        is_active: user.is_active,
        created_at: user.created_at,
        user_secret: user.user_secret // Retorna apenas uma vez
      })
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      if (error.code === '23505') { // Unique violation
        return sendErrorResponse(res, 409, 'Usuário já existe')
      }
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Autenticar usuário
  static async authenticateUser(req, res) {
    // #swagger.summary = 'Autenticar usuário'
    // #swagger.description = 'Autentica um usuário com suas credenciais e retorna tokens de acesso.'
    // #swagger.requestBody = {
    //   required: true,
    //   content: {
    //     "application/json": {
    //       schema: {
    //         type: "object",
    //         required: ["user_id", "user_secret"],
    //         properties: {
    //           user_id: {
    //             type: "string",
    //             description: "ID único do usuário (UUID)",
    //             example: "550e8400-e29b-41d4-a716-446655440000"
    //           },
    //           user_secret: {
    //             type: "string",
    //             description: "Senha do usuário",
    //             example: "minha_senha_secreta_123"
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
    try {
      const { user_id, user_secret } = req.body

      if (!user_id || !user_secret) {
        return sendErrorResponse(res, 400, 'ID do usuário e senha são obrigatórios')
      }

      const user = await AuthService.authenticateUser(user_id, user_secret)
      if (!user) {
        return sendErrorResponse(res, 401, 'Credenciais inválidas')
      }

      const tokens = await AuthService.generateAccessTokens(user)

      return sendSuccessResponse(res, 200, 'Autenticação realizada com sucesso', tokens)
    } catch (error) {
      console.error('Erro na autenticação:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Renovar token
  static async refreshToken(req, res) {
    // #swagger.summary = 'Renovar token de acesso'
    // #swagger.description = 'Renova o token de acesso usando um refresh token válido.'
    // #swagger.requestBody = {
    //   required: true,
    //   content: {
    //     "application/json": {
    //       schema: {
    //         type: "object",
    //         required: ["refresh_token"],
    //         properties: {
    //           refresh_token: {
    //             type: "string",
    //             description: "Refresh token para renovar o acesso",
    //             example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTYzNDU2Nzg5MCwiZXhwIjoxNjM1MTczNjkwfQ.example_signature"
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
    try {
      const { refresh_token } = req.body

      if (!refresh_token) {
        return sendErrorResponse(res, 400, 'Refresh token é obrigatório')
      }

      const tokens = await AuthService.refreshToken(refresh_token)
      if (!tokens) {
        return sendErrorResponse(res, 401, 'Refresh token inválido ou expirado')
      }

      return sendSuccessResponse(res, 200, 'Token renovado com sucesso', tokens)
    } catch (error) {
      console.error('Erro ao renovar token:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Revogar token
  static async revokeToken(req, res) {
    // #swagger.summary = 'Revogar token de acesso'
    // #swagger.description = 'Revoga um token de acesso, invalidando-o permanentemente.'
    // #swagger.requestBody = {
    //   required: true,
    //   content: {
    //     "application/json": {
    //       schema: {
    //         type: "object",
    //         required: ["access_token"],
    //         properties: {
    //           access_token: {
    //             type: "string",
    //             description: "Token de acesso a ser revogado",
    //             example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ1c2VyTmFtZSI6Ik1ldSBBcHAiLCJzY29wZSI6InJlYWQgd3JpdGUiLCJpYXQiOjE2MzQ1Njc4OTAsImV4cCI6MTYzNDY1NDI5MH0.example_signature"
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
    try {
      const { access_token } = req.body

      if (!access_token) {
        return sendErrorResponse(res, 400, 'Access token é obrigatório')
      }

      await AuthService.revokeToken(access_token)

      return sendSuccessResponse(res, 200, 'Token revogado com sucesso')
    } catch (error) {
      console.error('Erro ao revogar token:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Verificar token
  static async verifyToken(req, res) {
    // #swagger.summary = 'Verificar token de acesso'
    // #swagger.description = 'Verifica se um token de acesso é válido e retorna informações do usuário.'
    // #swagger.requestBody = {
    //   required: true,
    //   content: {
    //     "application/json": {
    //       schema: {
    //         type: "object",
    //         required: ["access_token"],
    //         properties: {
    //           access_token: {
    //             type: "string",
    //             description: "Token de acesso a ser verificado",
    //             example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ1c2VyTmFtZSI6Ik1ldSBBcHAiLCJzY29wZSI6InJlYWQgd3JpdGUiLCJpYXQiOjE2MzQ1Njc4OTAsImV4cCI6MTYzNDY1NDI5MH0.example_signature"
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
    try {
      const { access_token } = req.body

      if (!access_token) {
        return sendErrorResponse(res, 400, 'Access token é obrigatório')
      }

      const validation = await AuthService.validateToken(access_token)
      if (!validation) {
        return sendErrorResponse(res, 401, 'Token inválido ou expirado')
      }

      return sendSuccessResponse(res, 200, 'Token válido', {
        user: {
          user_id: validation.user.user_id,
          user_name: validation.user.user_name,
          user_documento_identificacao: validation.user.user_documento_identificacao,
          is_active: validation.user.is_active
        },
        token: {
          scope: validation.token.scope,
          expires_at: validation.token.expires_at
        }
      })
    } catch (error) {
      console.error('Erro ao verificar token:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Listar usuários (requer admin)
  static async listUsers(req, res) {
    // #swagger.summary = 'Listar todos os usuários'
    // #swagger.description = 'Lista todos os usuários cadastrados no sistema. Requer autenticação com escopo admin.'
    try {
      const users = await AuthService.getAllUsers()

      return sendSuccessResponse(res, 200, 'Usuários listados com sucesso', users)
    } catch (error) {
      console.error('Erro ao listar usuários:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Obter usuário específico (requer admin)
  static async getUser(req, res) {
    // #swagger.summary = 'Obter usuário específico'
    // #swagger.description = 'Obtém informações detalhadas de um usuário específico. Requer autenticação com escopo admin.'
    try {
      const { userId } = req.params

      const user = await AuthService.getUserById(userId)
      if (!user) {
        return sendErrorResponse(res, 404, 'Usuário não encontrado')
      }

      return sendSuccessResponse(res, 200, 'Usuário encontrado', {
        id: user.id,
        user_id: user.user_id,
        user_name: user.user_name,
        user_documento_identificacao: user.user_documento_identificacao,
        description: user.description,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      })
    } catch (error) {
      console.error('Erro ao obter usuário:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Atualizar usuário (requer admin)
  static async updateUser(req, res) {
    // #swagger.summary = 'Atualizar usuário'
    // #swagger.description = 'Atualiza informações de um usuário existente. Requer autenticação com escopo admin.'
    try {
      const { userId } = req.params
      const updates = req.body

      const user = await AuthService.updateUser(userId, updates)

      return sendSuccessResponse(res, 200, 'Usuário atualizado com sucesso', {
        id: user.id,
        user_id: user.user_id,
        user_name: user.user_name,
        user_documento_identificacao: user.user_documento_identificacao,
        description: user.description,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      })
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      if (error.message === 'Nenhum campo válido para atualização') {
        return sendErrorResponse(res, 400, error.message)
      }
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Deletar usuário (requer admin)
  static async deleteUser(req, res) {
    // #swagger.summary = 'Deletar usuário'
    // #swagger.description = 'Remove um usuário do sistema. Requer autenticação com escopo admin.'
    try {
      const { userId } = req.params

      const user = await AuthService.deleteUser(userId)
      if (!user) {
        return sendErrorResponse(res, 404, 'Usuário não encontrado')
      }

      return sendSuccessResponse(res, 200, 'Usuário deletado com sucesso')
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Listar tokens de um usuário (requer admin)
  static async listUserTokens(req, res) {
    // #swagger.summary = 'Listar tokens do usuário'
    // #swagger.description = 'Lista todos os tokens ativos de um usuário específico. Requer autenticação com escopo admin.'
    try {
      const { userId } = req.params

      const tokens = await AuthService.getUserTokens(userId)

      return sendSuccessResponse(res, 200, 'Tokens listados com sucesso', tokens)
    } catch (error) {
      console.error('Erro ao listar tokens:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }

  // Listar sessões de um usuário (requer admin)
  static async listUserSessions(req, res) {
    // #swagger.summary = 'Listar sessões do usuário'
    // #swagger.description = 'Lista todas as sessões WhatsApp de um usuário específico. Requer autenticação com escopo admin.'
    try {
      const { userId } = req.params

      const sessions = await AuthService.getUserSessions(userId)

      return sendSuccessResponse(res, 200, 'Sessões listadas com sucesso', sessions)
    } catch (error) {
      console.error('Erro ao listar sessões:', error)
      return sendErrorResponse(res, 500, 'Erro interno do servidor')
    }
  }
}

module.exports = AuthController 