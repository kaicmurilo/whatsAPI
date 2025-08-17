const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { query } = require('../database')
const { jwtSecret, jwtExpiresIn, jwtRefreshExpiresIn } = require('../config')

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

  // Gerar tokens
  static generateTokens(clientId) {
    const accessToken = jwt.sign(
      { clientId, type: 'access' },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    )

    const refreshToken = jwt.sign(
      { clientId, type: 'refresh' },
      jwtSecret,
      { expiresIn: jwtRefreshExpiresIn }
    )

    return { accessToken, refreshToken }
  }

  // Verificar token
  static verifyToken(token) {
    try {
      return jwt.verify(token, jwtSecret)
    } catch (error) {
      return null
    }
  }

  // Criar cliente
  static async createClient(clientName, description = '') {
    const clientId = uuidv4()
    const clientSecret = uuidv4()
    const hashedSecret = await this.hashPassword(clientSecret)

    const result = await query(
      'INSERT INTO clients (client_id, client_name, client_secret, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [clientId, clientName, hashedSecret, description]
    )

    return {
      ...result.rows[0],
      client_secret: clientSecret // Retorna a senha não criptografada apenas uma vez
    }
  }

  // Buscar cliente por ID
  static async getClientById(clientId) {
    const result = await query(
      'SELECT * FROM clients WHERE client_id = $1 AND is_active = true',
      [clientId]
    )
    return result.rows[0] || null
  }

  // Autenticar cliente
  static async authenticateClient(clientId, clientSecret) {
    const client = await this.getClientById(clientId)
    if (!client) {
      return { success: false, message: 'Cliente não encontrado' }
    }

    const isValidSecret = await this.verifyPassword(clientSecret, client.client_secret)
    if (!isValidSecret) {
      return { success: false, message: 'Credenciais inválidas' }
    }

    return { success: true, client }
  }

  // Criar token de acesso
  static async createAccessToken(clientId, scope = '') {
    const { accessToken, refreshToken } = this.generateTokens(clientId)
    const expiresAt = new Date(Date.now() + this.getExpirationTime(jwtExpiresIn))

    await query(
      'INSERT INTO tokens (client_id, access_token, refresh_token, expires_at, scope) VALUES ($1, $2, $3, $4, $5)',
      [clientId, accessToken, refreshToken, expiresAt, scope]
    )

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.getExpirationTime(jwtExpiresIn) / 1000,
      scope
    }
  }

  // Renovar token
  static async refreshToken(refreshToken) {
    const decoded = this.verifyToken(refreshToken)
    if (!decoded || decoded.type !== 'refresh') {
      return { success: false, message: 'Token de renovação inválido' }
    }

    // Verificar se o token existe e não foi revogado
    const result = await query(
      'SELECT * FROM tokens WHERE refresh_token = $1 AND is_revoked = false',
      [refreshToken]
    )

    if (result.rows.length === 0) {
      return { success: false, message: 'Token de renovação não encontrado ou revogado' }
    }

    const tokenRecord = result.rows[0]
    const newTokens = this.generateTokens(tokenRecord.client_id)
    const expiresAt = new Date(Date.now() + this.getExpirationTime(jwtExpiresIn))

    // Revogar token antigo e criar novo
    await query(
      'UPDATE tokens SET is_revoked = true WHERE refresh_token = $1',
      [refreshToken]
    )

    await query(
      'INSERT INTO tokens (client_id, access_token, refresh_token, expires_at, scope) VALUES ($1, $2, $3, $4, $5)',
      [tokenRecord.client_id, newTokens.accessToken, newTokens.refreshToken, expiresAt, tokenRecord.scope]
    )

    return {
      success: true,
      access_token: newTokens.accessToken,
      refresh_token: newTokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.getExpirationTime(jwtExpiresIn) / 1000,
      scope: tokenRecord.scope
    }
  }

  // Revogar token
  static async revokeToken(accessToken) {
    const result = await query(
      'UPDATE tokens SET is_revoked = true WHERE access_token = $1 RETURNING *',
      [accessToken]
    )
    return result.rows.length > 0
  }

  // Verificar token de acesso
  static async verifyAccessToken(accessToken) {
    const decoded = this.verifyToken(accessToken)
    if (!decoded || decoded.type !== 'access') {
      return { success: false, message: 'Token inválido' }
    }

    const result = await query(
      'SELECT * FROM tokens WHERE access_token = $1 AND is_revoked = false AND expires_at > NOW()',
      [accessToken]
    )

    if (result.rows.length === 0) {
      return { success: false, message: 'Token não encontrado, revogado ou expirado' }
    }

    const client = await this.getClientById(decoded.clientId)
    if (!client) {
      return { success: false, message: 'Cliente não encontrado' }
    }

    return { success: true, client, token: result.rows[0] }
  }

  // Listar tokens de um cliente
  static async getClientTokens(clientId) {
    const result = await query(
      'SELECT id, access_token, refresh_token, token_type, expires_at, scope, is_revoked, created_at FROM tokens WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    )
    return result.rows
  }

  // Limpar tokens expirados
  static async cleanupExpiredTokens() {
    const result = await query(
      'DELETE FROM tokens WHERE expires_at < NOW() AND is_revoked = true'
    )
    return result.rowCount
  }

  // Obter tempo de expiração em milissegundos
  static getExpirationTime(timeString) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    }
    
    const match = timeString.match(/^(\d+)([smhd])$/)
    if (!match) return 24 * 60 * 60 * 1000 // 24h padrão
    
    const [, value, unit] = match
    return parseInt(value) * units[unit]
  }

  // Listar todos os clientes
  static async getAllClients() {
    const result = await query(
      'SELECT id, client_id, client_name, description, is_active, created_at, updated_at FROM clients ORDER BY created_at DESC'
    )
    return result.rows
  }

  // Atualizar cliente
  static async updateClient(clientId, updates) {
    const allowedFields = ['client_name', 'description', 'is_active']
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key))
    
    if (fields.length === 0) {
      return null
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ')
    const values = [clientId, ...fields.map(field => updates[field])]

    const result = await query(
      `UPDATE clients SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE client_id = $1 RETURNING *`,
      values
    )

    return result.rows[0] || null
  }

  // Deletar cliente
  static async deleteClient(clientId) {
    const result = await query(
      'DELETE FROM clients WHERE client_id = $1 RETURNING *',
      [clientId]
    )
    return result.rows[0] || null
  }
}

module.exports = AuthService 