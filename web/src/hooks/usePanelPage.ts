import { awaitsQrScan } from '../lib/sessionStatus'
import type { WhatsAppSession } from '../types/api'
import { usePanelEvents } from './usePanelEvents'
import { useSessions } from './usePanelData'
import { usePanelSearchParams } from './usePanelSearchParams'

interface SelectedSession {
  session: WhatsAppSession
  showQr: boolean
}

function findSelectedSession(sessions: WhatsAppSession[] | undefined, sessionId: string | null): SelectedSession | null {
  const session = sessions?.find((candidate) => candidate.sessionId === sessionId)
  return session ? { session, showQr: awaitsQrScan(session.status) } : null
}

// Orquestra a tela: instâncias do servidor + seleção da URL + stream em tempo real
export function usePanelPage() {
  usePanelEvents()
  const sessions = useSessions()
  const { selection, ...actions } = usePanelSearchParams()
  const selectedSession = findSelectedSession(sessions.data, selection.sessionId)
  return { sessions, selectedSession, selection, ...actions }
}
