const { cache } = require('../utils/cache')
const { validateDatabaseConnection } = require('../database')
const qr = require('qr-image')

/**
 * Health check endpoint
 */
const healthCheck = async (req, res) => {
  // #swagger.summary = 'Health check'
  // #swagger.description = 'Returns the health status of the API'
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}

/**
 * Test QR endpoint without authentication
 */
const testQr = async (req, res) => {
  // #swagger.summary = 'Test QR generation'
  // #swagger.description = 'Generates a test QR code for testing purposes'
  try {
    const testData = 'https://example.com/test'
    console.log('🧪 Gerando QR code de teste...')
    
    const qrImage = qr.image(testData)
    
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache'
    })
    
    console.log('📤 Enviando QR code de teste')
    return qrImage.pipe(res)
  } catch (error) {
    console.error('❌ Erro ao gerar QR de teste:', error)
    res.status(500).json({ error: 'Erro ao gerar QR code de teste' })
  }
}

/**
 * Test QR endpoint with authentication simulation
 */
const testQrWithAuth = async (req, res) => {
  // #swagger.summary = 'Test QR generation with auth'
  // #swagger.description = 'Generates a test QR code with authentication simulation'
  try {
    console.log('🔐 Testando QR com autenticação...')
    console.log('📋 Headers recebidos:', req.headers)
    console.log('👤 Cliente:', req.client)
    console.log('🎫 Token:', req.token)
    
    const testData = 'https://example.com/test-auth'
    console.log('🧪 Gerando QR code de teste com auth...')
    
    const qrImage = qr.image(testData)
    
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache'
    })
    
    console.log('📤 Enviando QR code de teste com auth')
    return qrImage.pipe(res)
  } catch (error) {
    console.error('❌ Erro ao gerar QR de teste com auth:', error)
    res.status(500).json({ error: 'Erro ao gerar QR code de teste com auth' })
  }
}

/**
 * Local callback example for testing webhooks
 */
const localCallbackExample = async (req, res) => {
  // #swagger.summary = 'Local callback example'
  // #swagger.description = 'Example endpoint for testing webhooks locally'
  try {
    const { sessionId, dataType, data } = req.body
    
    // Log the webhook data
    // console.log('📨 Webhook recebido:', { sessionId, dataType, data })
    
    // Save to file for testing purposes
    const fs = require('fs')
    const path = require('path')
    const sessionsPath = process.env.SESSIONS_PATH || './sessions'
    const logPath = path.join(sessionsPath, 'message_log.txt')
    
    const logEntry = JSON.stringify({ sessionId, dataType, data }) + '\r\n'
    fs.appendFileSync(logPath, logEntry)
    
    /* #swagger.responses[200] = {
      description: "Webhook processed successfully",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/CallbackResponse" }
        }
      }
    }
    */
    res.json({ success: true })
  } catch (error) {
    console.error('localCallbackExample ERROR:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * Cache status endpoint
 */
const cacheStatus = async (req, res) => {
  // #swagger.summary = 'Cache status'
  // #swagger.description = 'Get cache system status and statistics'
  try {
    const status = cache.getStatus()
    
    /* #swagger.responses[200] = {
      description: "Cache status retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              cache: {
                type: "object",
                properties: {
                  useRedis: { type: "boolean" },
                  redisConnected: { type: "boolean" },
                  memoryCacheSize: { type: "number" }
                }
              }
            }
          }
        }
      }
    }
    */
    res.json({
      success: true,
      cache: status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('cacheStatus ERROR:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * Clear cache endpoint
 */
const clearCache = async (req, res) => {
  // #swagger.summary = 'Clear cache'
  // #swagger.description = 'Clear all cache data'
  try {
    await cache.flush()
    
    /* #swagger.responses[200] = {
      description: "Cache cleared successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" }
            }
          }
        }
      }
    }
    */
    res.json({
      success: true,
      message: 'Cache limpo com sucesso',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('clearCache ERROR:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * Database status endpoint
 */
const databaseStatus = async (req, res) => {
  // #swagger.summary = 'Database status'
  // #swagger.description = 'Check database connection and credentials'
  try {
    const dbValidation = await validateDatabaseConnection()
    
    if (dbValidation.success) {
      /* #swagger.responses[200] = {
        description: "Database is healthy",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                database: {
                  type: "object",
                  properties: {
                    connected: { type: "boolean" },
                    user: { type: "string" },
                    database: { type: "string" },
                    version: { type: "string" },
                    permissions: { type: "boolean" },
                    tables: {
                      type: "array",
                      items: { type: "string" }
                    },
                    activeClients: { type: "number" }
                  }
                },
                timestamp: { type: "string" }
              }
            }
          }
        }
      }
      */
      res.json({
        success: true,
        database: {
          connected: true,
          user: dbValidation.user,
          database: dbValidation.database,
          version: dbValidation.version,
          permissions: true,
          tables: dbValidation.tables,
          activeClients: dbValidation.activeClients
        },
        timestamp: new Date().toISOString()
      })
    } else {
      /* #swagger.responses[503] = {
        description: "Database is unhealthy",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                database: {
                  type: "object",
                  properties: {
                    connected: { type: "boolean" },
                    error: { type: "string" },
                    code: { type: "string" },
                    details: { type: "object" }
                  }
                },
                timestamp: { type: "string" }
              }
            }
          }
        }
      }
      */
      res.status(503).json({
        success: false,
        database: {
          connected: false,
          error: dbValidation.error,
          code: dbValidation.code,
          details: dbValidation.details || null
        },
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('databaseStatus ERROR:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

module.exports = {
  healthCheck,
  testQr,
  testQrWithAuth,
  localCallbackExample,
  cacheStatus,
  clearCache,
  databaseStatus
}
