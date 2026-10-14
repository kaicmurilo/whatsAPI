// Aviso de instância fora do ar: destino, modelo e placeholders. Funções puras (sem banco nem WhatsApp).

const DOWN_ALERT_MESSAGE_MAX = 1000
const DEFAULT_DOWN_ALERT_MESSAGE = '⚠️ A instância {instancia} está fora do ar há {minutos} min ({status}, desde {desde}).'
const PLACEHOLDERS = ['instancia', 'status', 'minutos', 'desde']

const STATUS_LABELS = {
  disconnected: 'desconectada',
  auth_failure: 'falha de autenticação',
  qr: 'deslogada, aguardando QR',
  starting: 'iniciando',
  authenticated: 'autenticada, sem sincronizar'
}

const CHAT_ID = /^\d{5,20}(-\d{5,20})?@(c\.us|g\.us)$/
const PHONE_DIGITS = /^\d{10,15}$/

/**
 * Aceita o id do WhatsApp (5511...@c.us / 1203...@g.us) ou um telefone com DDI em qualquer formato.
 * @returns {string | null} chatId normalizado ou null se inválido
 */
const normalizeAlertChatId = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (CHAT_ID.test(text)) return text
  const digits = text.replace(/[\s()+-]/g, '')
  return PHONE_DIGITS.test(digits) ? `${digits}@c.us` : null
}

/** Placeholder desconhecido fica como está: o usuário vê o erro na própria mensagem. */
const renderDownAlertMessage = (template, values) =>
  (template || DEFAULT_DOWN_ALERT_MESSAGE).replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match))

const statusLabel = (status) => STATUS_LABELS[status] || status

/**
 * Campos do aviso no PUT de configuração. Ausentes = desligado (compatível com quem não manda os campos).
 * @returns {{ value?: { downAlertEnabled: boolean, downAlertChatId: string | null, downAlertMessage: string | null }, error?: string }}
 */
const parseDownAlertInput = (body) => {
  const enabled = body.downAlertEnabled ?? false
  if (typeof enabled !== 'boolean') return { error: 'Aviso de instância fora do ar precisa ser verdadeiro ou falso' }
  const rawChatId = typeof body.downAlertChatId === 'string' ? body.downAlertChatId.trim() : ''
  const chatId = rawChatId ? normalizeAlertChatId(rawChatId) : null
  if (rawChatId && !chatId) return { error: 'Destino do aviso inválido: use o telefone com DDI (5511999998888) ou o id do grupo (1203...@g.us)' }
  if (enabled && !chatId) return { error: 'Informe o número ou grupo que recebe o aviso' }
  const message = typeof body.downAlertMessage === 'string' ? body.downAlertMessage.trim() : ''
  if (message.length > DOWN_ALERT_MESSAGE_MAX) return { error: `Mensagem do aviso com até ${DOWN_ALERT_MESSAGE_MAX} caracteres` }
  return { value: { downAlertEnabled: enabled, downAlertChatId: chatId, downAlertMessage: message || null } }
}

module.exports = {
  DEFAULT_DOWN_ALERT_MESSAGE,
  PLACEHOLDERS,
  normalizeAlertChatId,
  renderDownAlertMessage,
  statusLabel,
  parseDownAlertInput
}
