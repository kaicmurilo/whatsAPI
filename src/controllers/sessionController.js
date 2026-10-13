
const qr = require('qr-image')
const { setupSession, deleteSession, validateSession, flushSessions, sessions } = require('../sessions')
const { sendErrorResponse, waitForNestedObject } = require('../utils')

/**
 * Starts a session for the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error starting the session.
 */
const startSession = async (req, res) => {
  // #swagger.summary = 'Start new session'
  // #swagger.description = 'Starts a session for the given session ID.'
  try {
    const sessionId = req.params.sessionId
    
    // Se o cliente está autenticado, atualizar status da sessão
    if (req.client && req.session) {
      try {
        const { query } = require('../database')
        await query(
          'UPDATE whatsapp_sessions SET status = $1 WHERE session_id = $2 AND client_id = $3',
          ['starting', sessionId, req.client.client_id]
        )
      } catch (error) {
        console.error('Erro ao atualizar status da sessão:', error)
      }
    }
    
    const setupSessionReturn = setupSession(sessionId)
    if (!setupSessionReturn.success) {
      /* #swagger.responses[422] = {
        description: "Unprocessable Entity.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ErrorResponse" }
          }
        }
      }
      */
      sendErrorResponse(res, 422, setupSessionReturn.message)
      return
    }
    /* #swagger.responses[200] = {
      description: "Status of the initiated session.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/StartSessionResponse" }
        }
      }
    }
    */
    // wait until the client is created
    waitForNestedObject(setupSessionReturn.client, 'pupPage')
      .then(async () => {
        // Se o cliente está autenticado, atualizar status para connected
        if (req.client && req.session) {
          try {
            const { query } = require('../database')
            await query(
              'UPDATE whatsapp_sessions SET status = $1 WHERE session_id = $2 AND client_id = $3',
              ['connected', sessionId, req.client.client_id]
            )
          } catch (error) {
            console.error('Erro ao atualizar status da sessão:', error)
          }
        }
        res.json({ success: true, message: setupSessionReturn.message })
      })
      .catch((err) => { sendErrorResponse(res, 500, err.message) })
  } catch (error) {
  /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('startSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Status of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const statusSession = async (req, res) => {
  // #swagger.summary = 'Get session status'
  // #swagger.description = 'Status of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const sessionData = await validateSession(sessionId)
    /* #swagger.responses[200] = {
      description: "Status of the session.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/StatusSessionResponse" }
        }
      }
    }
    */
    res.json(sessionData)
  } catch (error) {
    console.log('statusSession ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Resolve o nome dado à instância na criação para o sessionId usado nas demais rotas.
 * Dono e liberação da API key já foram conferidos por requireSessionOwnership (req.session).
 *
 * @param {Object} req - req.session: linha de whatsapp_sessions da instância
 * @param {Object} res - The HTTP response object.
 */
const getSessionByName = (req, res) => {
  // Documentação Swagger da rota: src/routes/userRoutes.js
  res.json({ success: true, sessionId: req.session.session_id, status: req.session.status })
}

/**
 * QR code of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const sessionQrCode = async (req, res) => {
  // #swagger.summary = 'Get session QR code'
  // #swagger.description = 'QR code of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    console.log(`📱 Requisição de QR code para sessão: ${sessionId}`)
    
    const session = sessions.get(sessionId)
    if (!session) {
      console.log(`❌ Sessão não encontrada: ${sessionId}`)
      return res.json({ success: false, message: 'session_not_found' })
    }
    
    if (session.qr) {
      console.log(`✅ QR code disponível para sessão: ${sessionId}`)
      console.log(`📊 Tamanho do QR code: ${session.qr.length} caracteres`)
      console.log(`🔗 QR code: ${session.qr.substring(0, 50)}...`)
      
      return res.json({ success: true, qr: session.qr })
    }
    
    console.log(`⚠️ QR code não disponível para sessão: ${sessionId} (não está pronto ou já foi escaneado)`)
    return res.json({ success: false, message: 'qr code not ready or already scanned' })
  } catch (error) {
    console.log('sessionQrCode ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * QR code as image of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const sessionQrCodeImage = async (req, res) => {
  // #swagger.summary = 'Get session QR code as image'
  // #swagger.description = 'QR code as image of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    console.log(`📱 Requisição de imagem QR para sessão: ${sessionId}`)
    
    const session = sessions.get(sessionId)
    if (!session) {
      console.log(`❌ Sessão não encontrada: ${sessionId}`)
      return res.json({ success: false, message: 'session_not_found' })
    }
    
    if (session.qr) {
      console.log(`✅ QR code disponível para sessão: ${sessionId}`)
      console.log(`📊 Tamanho do QR code: ${session.qr.length} caracteres`)
      
      const qrImage = qr.image(session.qr)
      
      // Log adicional sobre a imagem gerada
      console.log(`🖼️ Gerando imagem PNG do QR code para sessão: ${sessionId}`)
      
      /* #swagger.responses[200] = {
          description: "QR image.",
          content: {
            "image/png": {}
          }
        }
      */
      res.writeHead(200, {
        'Content-Type': 'image/png'
      })
      
      console.log(`📤 Enviando imagem QR para sessão: ${sessionId}`)
      return qrImage.pipe(res)
    }
    
    console.log(`⚠️ QR code não disponível para sessão: ${sessionId} (não está pronto ou já foi escaneado)`)
    return res.json({ success: false, message: 'qr code not ready or already scanned' })
  } catch (error) {
    console.log('sessionQrCodeImage ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to terminate.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the session.
 */
const terminateSession = async (req, res) => {
  // #swagger.summary = 'Terminate session'
  // #swagger.description = 'Terminates the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const validation = await validateSession(sessionId)
    if (validation.message === 'session_not_found') {
      return res.json(validation)
    }
    await deleteSession(sessionId, validation)
    
    // Se o cliente está autenticado, atualizar status da sessão
    if (req.client && req.session) {
      try {
        const { query } = require('../database')
        await query(
          'UPDATE whatsapp_sessions SET status = $1 WHERE session_id = $2 AND client_id = $3',
          ['terminated', sessionId, req.client.client_id]
        )
      } catch (error) {
        console.error('Erro ao atualizar status da sessão:', error)
      }
    }
    
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates all inactive sessions.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the sessions.
 */
const terminateInactiveSessions = async (req, res) => {
  // #swagger.summary = 'Terminate inactive sessions'
  // #swagger.description = 'Terminates all inactive sessions.'
  try {
    await flushSessions(true)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionsResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Flush completed successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateInactiveSessions ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates all sessions.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the sessions.
 */
const terminateAllSessions = async (req, res) => {
  // #swagger.summary = 'Terminate all sessions'
  // #swagger.description = 'Terminates all sessions.'
  try {
    await flushSessions(false)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionsResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Flush completed successfully' })
  } catch (error) {
  /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateAllSessions ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  startSession,
  statusSession,
  getSessionByName,
  sessionQrCode,
  sessionQrCodeImage,
  terminateSession,
  terminateInactiveSessions,
  terminateAllSessions
}
