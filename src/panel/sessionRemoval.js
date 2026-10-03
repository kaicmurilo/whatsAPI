const { query } = require('../database')
const { validateSession, deleteSession } = require('../sessions')

// Disparos que ainda vão enviar: a instância removida sai do rodízio deles
const OPEN_RUN_STATUSES = ['running', 'paused', 'interrupted', 'scheduled', 'awaiting']

/**
 * Remove a instância do WhatsApp: encerra o client (logout se conectado), apaga a pasta da sessão,
 * tira do rodízio dos disparos abertos e apaga o registro (mensagens salvas vão junto, em cascata).
 * @returns {Promise<{ removedFromRuns: number } | null>} null se a instância não é do usuário
 */
const removeWhatsAppInstance = async (userId, sessionId) => {
  const owned = await query('SELECT 1 FROM whatsapp_sessions WHERE user_id = $1 AND session_id = $2', [userId, sessionId])
  if (owned.rows.length === 0) return null
  const validation = await validateSession(sessionId)
  if (validation.message !== 'session_not_found') await deleteSession(sessionId, validation)
  const runs = await query(
    `UPDATE broadcast_runs SET session_ids = array_remove(session_ids, $2)
     WHERE user_id = $1 AND status = ANY($3::text[]) AND $2 = ANY(session_ids)`,
    [userId, sessionId, OPEN_RUN_STATUSES]
  )
  await query('DELETE FROM whatsapp_sessions WHERE user_id = $1 AND session_id = $2', [userId, sessionId])
  return { removedFromRuns: runs.rowCount }
}

module.exports = { removeWhatsAppInstance }
