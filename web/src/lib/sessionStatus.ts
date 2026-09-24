import type { SessionStatus } from '../types/api'

export type StatusTone = 'live' | 'pending' | 'alert' | 'idle'

interface StatusPresentation {
  label: string
  tone: StatusTone
}

const STATUS_PRESENTATION: Record<SessionStatus, StatusPresentation> = {
  connected: { label: 'Conectada', tone: 'live' },
  authenticated: { label: 'Autenticando', tone: 'pending' },
  starting: { label: 'Iniciando', tone: 'pending' },
  qr: { label: 'Aguardando QR', tone: 'pending' },
  disconnected: { label: 'Desconectada', tone: 'alert' },
  auth_failure: { label: 'Falha no login', tone: 'alert' },
  stopped: { label: 'Parada', tone: 'idle' },
}

export const presentStatus = (status: SessionStatus): StatusPresentation => STATUS_PRESENTATION[status]

// Instâncias que ainda podem gerar QR — o painel mostra o código enquanto estiverem nesses estados
export const awaitsQrScan = (status: SessionStatus): boolean => status === 'qr' || status === 'starting'

// Mesmas regras de sessionNameValidation no backend
export const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{10,100}$/
