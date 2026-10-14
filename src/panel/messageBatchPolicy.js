// Agrupamento de textos da integração: regras puras (sem banco nem WhatsApp)

const BATCH_WINDOW_MIN = 1
const BATCH_WINDOW_MAX = 60
const BATCH_WINDOW_DEFAULT = 5
const PART_SEPARATOR = '\n\n'

// Só texto puro junta num texto; texto com mídia anexada (options.media) e outros tipos saem na hora
const isBatchable = (contentType, content, options) =>
  contentType === 'string' && typeof content === 'string' && content.length > 0 && !options?.media

const joinParts = (parts) => parts.join(PART_SEPARATOR)

// Instância fixa e balanceado não se misturam: cada forma de enviar tem o próprio lote
const senderKeyOf = ({ isBalanced, sessionIds }) =>
  isBalanced ? `balanced:${[...sessionIds].sort().join(',')}` : `session:${sessionIds[0]}`

/**
 * Campos do agrupamento no PUT de configuração. Ausentes = desligado com a janela padrão.
 * @returns {{ value?: { batchEnabled: boolean, batchWindowMinutes: number }, error?: string }}
 */
const parseBatchInput = (body) => {
  const enabled = body.batchEnabled ?? false
  if (typeof enabled !== 'boolean') return { error: 'Agrupamento de mensagens precisa ser verdadeiro ou falso' }
  const minutes = body.batchWindowMinutes ?? BATCH_WINDOW_DEFAULT
  if (!Number.isInteger(minutes) || minutes < BATCH_WINDOW_MIN || minutes > BATCH_WINDOW_MAX) {
    return { error: `Tempo do agrupamento entre ${BATCH_WINDOW_MIN} e ${BATCH_WINDOW_MAX} minutos` }
  }
  return { value: { batchEnabled: enabled, batchWindowMinutes: minutes } }
}

module.exports = { BATCH_WINDOW_MIN, BATCH_WINDOW_MAX, isBatchable, joinParts, senderKeyOf, parseBatchInput }
