const { cache } = require('../utils/cache')

/**
 * Health check endpoint
 */
const ping = async (req, res) => {
  // #swagger.summary = 'Health check'
  // #swagger.description = 'Check if the server is alive'
  try {
    const cacheStatus = cache.getStatus()
    
    /* #swagger.responses[200] = {
      description: "Server is alive",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/PingResponse" }
        }
      }
    }
    */
    res.json({
      success: true,
      message: 'pong',
      timestamp: new Date().toISOString(),
      cache: cacheStatus
    })
  } catch (error) {
    console.error('ping ERROR:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
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

module.exports = {
  ping,
  localCallbackExample,
  cacheStatus,
  clearCache
}
