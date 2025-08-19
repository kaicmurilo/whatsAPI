const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { query } = require('../database')
const config = require('../config')

class AuthService {
  // Gerar hash da senha
  static async hashPassword(password) {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  // Verificar senha
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash)
  }

  // Gerar token JWT
  static generateToken(payload, expiresIn = config.jwtExpiresIn) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn })
  }

  // Verificar token JWT
  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret)
    } catch (error) {
      return null
    }
  }

  // Criar usuário
  static async createUser(userName, description = '', userDocumentoIdentificacao = null) {
    const userId = uuidv4()
    const userSecret = uuidv4()
    const hashedSecret = await this.hashPassword(userSecret)

    const result = await query(
      'INSERT INTO users (user_id, user_name, user_secret, user_documento_identificacao, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, userName, hashedSecret, userDocumentoIdentificacao, description]
    )

    // Retornar dados do usuário sem a senha, mas incluir a senha temporariamente para o primeiro acesso
    const userData = { ...result.rows[0] }
    delete userData.user_secret // Remover senha criptografada
    
    return {
      ...userData,
      temporary_secret: userSecret // Retorna apenas uma vez para configuração inicial
    }
  }

  // Buscar usuário por ID
  static async getUserById(userId) {
    const result = await query(
      'SELECT * FROM users WHERE user_id = $1 AND is_active = true',
      [userId]
    )
    return result.rows[0]
  }

  // Autenticar usuário
  static async authenticateUser(userId, userSecret) {
    const user = await this.getUserById(userId)
    if (!user) return null

    const isValidSecret = await this.verifyPassword(userSecret, user.user_secret)
    if (!isValidSecret) return null

    return user
  }

  // Gerar tokens de acesso
  static async generateAccessTokens(user) {
    const accessToken = this.generateToken({
      userId: user.user_id,
      userName: user.user_name,
      scope: 'read write'
    }, config.jwtExpiresIn)

    const refreshToken = this.generateToken({
      userId: user.user_id,
      type: 'refresh'
    }, config.jwtRefreshExpiresIn)

    // Salvar tokens no banco
    await query(
      'INSERT INTO tokens (user_id, access_token, refresh_token, expires_at, scope) VALUES ($1, $2, $3, $4, $5)',
      [user.user_id, accessToken, refreshToken, this.getExpirationTime(config.jwtExpiresIn), 'read write']
    )

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: config.jwtExpiresIn,
      scope: 'read write'
    }
  }

  // Renovar token
  static async refreshToken(refreshToken) {
    const decoded = this.verifyToken(refreshToken)
    if (!decoded || decoded.type !== 'refresh') return null

    const user = await this.getUserById(decoded.userId)
    if (!user) return null

    // Verificar se o refresh token existe no banco
    const tokenResult = await query(
      'SELECT * FROM tokens WHERE refresh_token = $1 AND is_revoked = false',
      [refreshToken]
    )

    if (tokenResult.rows.length === 0) return null

    // Revogar tokens antigos
    await query(
      'UPDATE tokens SET is_revoked = true WHERE user_id = $1',
      [user.user_id]
    )

    // Gerar novos tokens
    return await this.generateAccessTokens(user)
  }

  // Revogar token
  static async revokeToken(accessToken) {
    await query(
      'UPDATE tokens SET is_revoked = true WHERE access_token = $1',
      [accessToken]
    )
    return true
  }

  // Verificar token válido
  static async validateToken(accessToken) {
    const decoded = this.verifyToken(accessToken)
    if (!decoded) return null

    const tokenResult = await query(
      'SELECT * FROM tokens WHERE access_token = $1 AND is_revoked = false AND expires_at > NOW()',
      [accessToken]
    )

    if (tokenResult.rows.length === 0) return null

    const user = await this.getUserById(decoded.userId)
    if (!user) return null

    return {
      user,
      token: tokenResult.rows[0],
      decoded
    }
  }

  // Limpar tokens expirados
  static async cleanupExpiredTokens() {
    const result = await query(
      'DELETE FROM tokens WHERE expires_at < NOW() OR is_revoked = true'
    )
    return result.rowCount
  }

  // Obter tempo de expiração
  static getExpirationTime(timeString) {
    const now = new Date()
    const unit = timeString.slice(-1)
    const value = parseInt(timeString.slice(0, -1))

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000)
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000)
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000)
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h padrão
    }
  }

  // Listar todos os usuários
  static async getAllUsers() {
    const result = await query(
      'SELECT id, user_id, user_name, user_documento_identificacao, description, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
    )
    return result.rows
  }

  // Atualizar usuário
  static async updateUser(userId, updates) {
    const allowedFields = ['user_name', 'user_documento_identificacao', 'description', 'is_active']
    const validUpdates = {}
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field]
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('Nenhum campo válido para atualização')
    }

    const setClause = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ')
    const values = [userId, ...Object.values(validUpdates)]

    const result = await query(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *`,
      values
    )

    return result.rows[0]
  }

  // Deletar usuário
  static async deleteUser(userId) {
    const result = await query(
      'DELETE FROM users WHERE user_id = $1 RETURNING *',
      [userId]
    )
    return result.rows[0]
  }

  // Listar tokens de um usuário
  static async getUserTokens(userId) {
    const result = await query(
      'SELECT id, access_token, refresh_token, token_type, expires_at, scope, is_revoked, created_at FROM tokens WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )
    return result.rows
  }

  // Listar sessões de um usuário
  static async getUserSessions(userId) {
    const result = await query(
      'SELECT id, session_id, status, created_at, updated_at FROM whatsapp_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )
    return result.rows
  }
}

module.exports = AuthService 