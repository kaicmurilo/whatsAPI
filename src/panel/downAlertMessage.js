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

const GROUP_CHAT_ID = /^\d{5,30}(-\d{5,20})?@g\.us$/
const PHONE_DIGITS = /^\d{10,15}$/
const MAX_TARGETS = 20
const TARGET_NAME_MAX = 100

const targetName = (name, fallback) => {
  const text = typeof name === 'string' ? name.trim().slice(0, TARGET_NAME_MAX) : ''
  return text || fallback
}

/**
 * Um destino do aviso: contato da agenda (telefone com DDI) ou grupo (id @g.us).
 * @returns {{ kind: 'contact', phone: string, name: string } | { kind: 'group', chatId: string, name: string } | null}
 */
const parseAlertTarget = (target) => {
  if (!target || typeof target !== 'object') return null
  if (target.kind === 'contact') {
    const phone = typeof target.phone === 'string' ? target.phone.replace(/\D/g, '') : ''
    return PHONE_DIGITS.test(phone) ? { kind: 'contact', phone, name: targetName(target.name, phone) } : null
  }
  if (target.kind === 'group') {
    const chatId = typeof target.chatId === 'string' ? target.chatId.trim() : ''
    return GROUP_CHAT_ID.test(chatId) ? { kind: 'group', chatId, name: targetName(target.name, chatId) } : null
  }
  return null
}

const targetKey = (target) => (target.kind === 'group' ? target.chatId : `${target.phone}@c.us`)

/** Placeholder desconhecido fica como está: o usuário vê o erro na própria mensagem. */
const renderDownAlertMessage = (template, values) =>
  (template || DEFAULT_DOWN_ALERT_MESSAGE).replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match))

const statusLabel = (status) => STATUS_LABELS[status] || status

/**
 * Campos do aviso no PUT de configuração. Ausentes = desligado (compatível com quem não manda os campos).
 * Destino repetido entra uma vez só.
 */
const parseDownAlertInput = (body) => {
  const enabled = body.downAlertEnabled ?? false
  if (typeof enabled !== 'boolean') return { error: 'Aviso de instância fora do ar precisa ser verdadeiro ou falso' }
  const rawTargets = body.downAlertTargets ?? []
  if (!Array.isArray(rawTargets)) return { error: 'Destinos do aviso inválidos' }
  if (rawTargets.length > MAX_TARGETS) return { error: `No máximo ${MAX_TARGETS} destinos para o aviso` }
  const targets = []
  for (const raw of rawTargets) {
    const target = parseAlertTarget(raw)
    if (!target) return { error: 'Destino do aviso inválido: escolha um contato da agenda ou um grupo da lista' }
    if (!targets.some((saved) => targetKey(saved) === targetKey(target))) targets.push(target)
  }
  if (enabled && targets.length === 0) return { error: 'Escolha ao menos um contato ou grupo para receber o aviso' }
  const message = typeof body.downAlertMessage === 'string' ? body.downAlertMessage.trim() : ''
  if (message.length > DOWN_ALERT_MESSAGE_MAX) return { error: `Mensagem do aviso com até ${DOWN_ALERT_MESSAGE_MAX} caracteres` }
  return { value: { downAlertEnabled: enabled, downAlertTargets: targets, downAlertMessage: message || null } }
}

module.exports = {
  DEFAULT_DOWN_ALERT_MESSAGE,
  PLACEHOLDERS,
  parseAlertTarget,
  targetKey,
  renderDownAlertMessage,
  statusLabel,
  parseDownAlertInput
}
