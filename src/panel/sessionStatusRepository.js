const { query } = require('../database')

// Espelha no banco o status que o painel já mantém em memória, para quem lê whatsapp_sessions.status
// (API /session/byName, rotas de admin). Falha no banco não pode travar o evento do WhatsApp.
const persistSessionStatus = (sessionId, status) => {
  query('UPDATE whatsapp_sessions SET status = $2 WHERE session_id = $1 AND status IS DISTINCT FROM $2', [sessionId, status])
    .catch((error) => console.error(`[session] falha ao gravar status sessão=${sessionId} status=${status}:`, error.message))
}

module.exports = { persistSessionStatus }
