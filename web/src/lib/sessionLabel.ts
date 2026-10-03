import type { SenderInstance, WhatsAppSession } from '../types/api'
import { formatPhone } from './format'

// Nome escolhido ao criar a instância. Nome e telefone do WhatsApp são detalhe, não o título.
export const whatsappIdentity = (session: Pick<WhatsAppSession, 'pushName' | 'phone'>): string | null => {
  const parts = [session.pushName, session.phone ? formatPhone(session.phone) : null].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : null
}

// Bot do Telegram aparece como @username (label); número do WhatsApp, pelo id escolhido
export const instanceTitle = (session: SenderInstance): string => session.label ?? session.sessionId

export const instanceChoiceLabel = (session: SenderInstance): string => {
  const identity = whatsappIdentity(session)
  const down = session.status === 'connected' ? '' : ' (desconectada)'
  return identity ? `${instanceTitle(session)} · ${identity}${down}` : `${instanceTitle(session)}${down}`
}
