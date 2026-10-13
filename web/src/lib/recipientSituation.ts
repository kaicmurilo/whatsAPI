import type { RecipientSituation } from '../types/api'

export const SITUATION_LABELS: Record<RecipientSituation, string> = {
  pending: 'Pendente',
  awaiting_reply: 'Aguardando resposta',
  suppressed: 'Suprimido',
  duplicate: 'Duplicado',
  replied: 'Respondeu',
  removed: 'Removido da fila',
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  failed: 'Falhou',
}
