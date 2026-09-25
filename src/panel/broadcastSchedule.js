const MINUTE_MS = 60 * 1000
const MIN_LEAD_MS = 1 * MINUTE_MS // folga para o painel não programar "para agora" por engano
const MAX_AHEAD_MS = 90 * 24 * 60 * MINUTE_MS
// Passou disso do horário e ainda não deu para enviar (servidor/instância fora) → falha em vez de mandar atrasado
const LATE_GRACE_MS = 30 * MINUTE_MS

/**
 * Horário programado vindo do painel (ISO com fuso). Ausente → envio imediato.
 * @returns {{ scheduledAt: Date|null, error?: string }}
 */
const parseScheduledAt = (value, now = new Date()) => {
  if (value === undefined || value === null || value === '') return { scheduledAt: null }
  const scheduledAt = new Date(value)
  if (typeof value !== 'string' || Number.isNaN(scheduledAt.getTime())) return { error: 'Data/hora de envio inválida' }
  if (scheduledAt.getTime() < now.getTime() + MIN_LEAD_MS) return { error: 'Programe para pelo menos 1 minuto à frente' }
  if (scheduledAt.getTime() > now.getTime() + MAX_AHEAD_MS) return { error: 'Programe para no máximo 90 dias à frente' }
  return { scheduledAt }
}

/**
 * O que o agendador faz com um disparo programado vencido.
 * - start: instância conectada e livre
 * - wait: ainda dá tempo (ou está na fila atrás de outro disparo da mesma instância — isso não expira)
 * - expire: passou da tolerância com a instância desconectada
 */
const decideScheduledAction = ({ scheduledAt, now, isConnected, isBusy }) => {
  if (isConnected && !isBusy) return 'start'
  if (isConnected && isBusy) return 'wait'
  return now.getTime() - new Date(scheduledAt).getTime() > LATE_GRACE_MS ? 'expire' : 'wait'
}

module.exports = { parseScheduledAt, decideScheduledAction, LATE_GRACE_MS }
