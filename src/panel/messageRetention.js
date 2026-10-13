const { query } = require('../database')

const SWEEP_INTERVAL_MS = 5 * 60 * 1000

// Apaga o histórico mais velho que a retenção de cada conta. Envios da integração (api_sent_messages)
// e transmissões não entram: o dashboard e o balanceamento continuam contando.
const deleteExpiredMessages = async () => {
  const result = await query(
    `DELETE FROM whatsapp_messages m
     USING whatsapp_sessions s, panel_user_settings p
     WHERE m.session_id = s.session_id
       AND p.user_id = s.user_id
       AND p.message_retention_hours IS NOT NULL
       AND m.sent_at < CURRENT_TIMESTAMP - make_interval(hours => p.message_retention_hours)`
  )
  return result.rowCount
}

const sweep = async () => {
  try {
    const deleted = await deleteExpiredMessages()
    if (deleted > 0) console.log(`[panel] retenção: ${deleted} mensagem(ns) antiga(s) apagada(s)`)
  } catch (error) {
    console.error('[panel] falha na limpeza de mensagens pela retenção:', error.message)
  }
}

/**
 * ponytail: um DELETE por rodada, sem lote; se a primeira limpeza de uma conta grande travar o banco,
 * apagar em lotes (ctid IN (... LIMIT n)) até zerar.
 */
const startMessageRetention = () => {
  setInterval(sweep, SWEEP_INTERVAL_MS).unref()
  sweep()
  console.log(`[panel] retenção de mensagens ativa (verifica a cada ${SWEEP_INTERVAL_MS / 60000} min)`)
}

module.exports = { startMessageRetention, deleteExpiredMessages }
