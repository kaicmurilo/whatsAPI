const { query } = require('../database')

// Janela para o vínculo tardio: timestamp da mensagem (WhatsApp) × sent_at gravado após o upload terminar
const LATE_LINK_WINDOW = '2 minutes'

// Ack do WhatsApp: 2 = entregue, 3 = lido, 4 = reproduzido. Cada nível preenche os anteriores que faltarem
// (lido implica entregue) e nunca sobrescreve um horário já gravado.
const ACK_COLUMNS = `
  delivered_at = CASE WHEN $2::int >= 2 THEN COALESCE(delivered_at, $3::timestamptz) ELSE delivered_at END,
  read_at      = CASE WHEN $2::int >= 3 THEN COALESCE(read_at, $3::timestamptz) ELSE read_at END,
  played_at    = CASE WHEN $2::int >= 4 THEN COALESCE(played_at, $3::timestamptz) ELSE played_at END`

// Casa pela chave estável: o mesmo envio chega com remote LID num ack e com telefone no outro
const applyAckByKey = async ({ messageKey, ack, at }) => {
  const result = await query(
    `UPDATE broadcast_run_recipients SET ${ACK_COLUMNS}
     WHERE message_key = $1
     RETURNING run_id AS "runId"`,
    [messageKey, ack, at]
  )
  return result.rows[0]?.runId || null
}

// Envio sem id (wwebjs devolveu undefined): liga ao destinatário enviado mais próximo no tempo, mesmo telefone
const linkAndApplyAck = async ({ messageId, messageKey, ack, at, phones, messageSentAt }) => {
  const result = await query(
    `WITH target AS (
       SELECT run_id, position
       FROM broadcast_run_recipients
       WHERE message_key IS NULL AND status = 'sent' AND phone = ANY($4::text[])
         AND sent_at BETWEEN $5::timestamptz - INTERVAL '${LATE_LINK_WINDOW}' AND $5::timestamptz + INTERVAL '${LATE_LINK_WINDOW}'
       ORDER BY abs(extract(epoch FROM sent_at - $5::timestamptz))
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE broadcast_run_recipients r SET message_id = $1, message_key = $6, ${ACK_COLUMNS}
     FROM target WHERE r.run_id = target.run_id AND r.position = target.position
     RETURNING r.run_id AS "runId"`,
    [messageId, ack, at, phones, messageSentAt, messageKey]
  )
  return result.rows[0]?.runId || null
}

/**
 * Registra um tique de entrega/leitura. Devolve o id do disparo afetado (ou null se a mensagem
 * não é de transmissão — acks de conversas normais passam por aqui e são ignorados).
 */
const recordDeliveryAck = async ({ messageId, messageKey, ack, at, phones, messageSentAt }) => {
  const runId = await applyAckByKey({ messageKey, ack, at })
  if (runId || phones.length === 0) return runId
  return linkAndApplyAck({ messageId, messageKey, ack, at, phones, messageSentAt })
}

// Destinatários enviados com id conhecido que ainda podem ganhar entregue/lido/reproduzido
const listRecipientsToReconcile = async (runId) => {
  const result = await query(
    `SELECT run_id AS "runId", position, message_id AS "messageId"
     FROM broadcast_run_recipients
     WHERE run_id = $1 AND status = 'sent' AND message_id IS NOT NULL
       AND (delivered_at IS NULL OR read_at IS NULL OR played_at IS NULL)
     ORDER BY position`,
    [runId]
  )
  return result.rows
}

// Disparos recentes da instância (conciliação automática ao conectar)
const listRecentRunIds = async (sessionId, days) => {
  const result = await query(
    `SELECT id FROM broadcast_runs
     WHERE session_id = $1 AND created_at > CURRENT_TIMESTAMP - make_interval(days => $2::int)
     ORDER BY created_at DESC`,
    [sessionId, days]
  )
  return result.rows.map((row) => row.id)
}

// Horários reais vindos do "Dados da mensagem" do WhatsApp; nunca sobrescreve o que já foi gravado
const applyDeliveryTimes = async ({ runId, position, deliveredAt, readAt, playedAt }) => {
  const result = await query(
    `UPDATE broadcast_run_recipients
     SET delivered_at = COALESCE(delivered_at, $3::timestamptz, $4::timestamptz, $5::timestamptz),
         read_at      = COALESCE(read_at, $4::timestamptz, $5::timestamptz),
         played_at    = COALESCE(played_at, $5::timestamptz)
     WHERE run_id = $1 AND position = $2
       AND ((delivered_at IS NULL AND COALESCE($3::timestamptz, $4::timestamptz, $5::timestamptz) IS NOT NULL)
         OR (read_at IS NULL AND COALESCE($4::timestamptz, $5::timestamptz) IS NOT NULL)
         OR (played_at IS NULL AND $5::timestamptz IS NOT NULL))`,
    [runId, position, deliveredAt, readAt, playedAt]
  )
  return result.rowCount > 0
}

module.exports = { recordDeliveryAck, listRecipientsToReconcile, listRecentRunIds, applyDeliveryTimes }
