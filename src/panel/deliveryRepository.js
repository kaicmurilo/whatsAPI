const { query } = require('../database')

// Janela para o vínculo tardio: timestamp da mensagem (WhatsApp) × sent_at gravado após o upload terminar
const LATE_LINK_WINDOW = '2 minutes'

// Ack do WhatsApp: 2 = entregue, 3 = lido, 4 = reproduzido. Cada nível preenche os anteriores que faltarem
// (lido implica entregue) e nunca sobrescreve um horário já gravado.
const ACK_COLUMNS = `
  delivered_at = CASE WHEN $2::int >= 2 THEN COALESCE(delivered_at, $3::timestamptz) ELSE delivered_at END,
  read_at      = CASE WHEN $2::int >= 3 THEN COALESCE(read_at, $3::timestamptz) ELSE read_at END,
  played_at    = CASE WHEN $2::int >= 4 THEN COALESCE(played_at, $3::timestamptz) ELSE played_at END`

const applyAckById = async ({ messageId, ack, at }) => {
  const result = await query(
    `UPDATE broadcast_run_recipients SET ${ACK_COLUMNS}
     WHERE message_id = $1
     RETURNING run_id AS "runId"`,
    [messageId, ack, at]
  )
  return result.rows[0]?.runId || null
}

// Envio sem id (wwebjs devolveu undefined): liga ao destinatário enviado mais próximo no tempo, mesmo telefone
const linkAndApplyAck = async ({ messageId, ack, at, phones, messageSentAt }) => {
  const result = await query(
    `WITH target AS (
       SELECT run_id, position
       FROM broadcast_run_recipients
       WHERE message_id IS NULL AND status = 'sent' AND phone = ANY($4::text[])
         AND sent_at BETWEEN $5::timestamptz - INTERVAL '${LATE_LINK_WINDOW}' AND $5::timestamptz + INTERVAL '${LATE_LINK_WINDOW}'
       ORDER BY abs(extract(epoch FROM sent_at - $5::timestamptz))
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE broadcast_run_recipients r SET message_id = $1, ${ACK_COLUMNS}
     FROM target WHERE r.run_id = target.run_id AND r.position = target.position
     RETURNING r.run_id AS "runId"`,
    [messageId, ack, at, phones, messageSentAt]
  )
  return result.rows[0]?.runId || null
}

/**
 * Registra um tique de entrega/leitura. Devolve o id do disparo afetado (ou null se a mensagem
 * não é de transmissão — acks de conversas normais passam por aqui e são ignorados).
 */
const recordDeliveryAck = async ({ messageId, ack, at, phones, messageSentAt }) => {
  const runId = await applyAckById({ messageId, ack, at })
  if (runId || phones.length === 0) return runId
  return linkAndApplyAck({ messageId, ack, at, phones, messageSentAt })
}

module.exports = { recordDeliveryAck }
