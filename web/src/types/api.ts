export type SessionStatus =
  | 'starting'
  | 'qr'
  | 'authenticated'
  | 'connected'
  | 'disconnected'
  | 'auth_failure'
  | 'stopped'

export interface WhatsAppSession {
  sessionId: string
  status: SessionStatus
  phone: string | null
  pushName: string | null
  createdAt: string
}

export interface ChatSummary {
  chatId: string
  chatName: string | null
  // Nome da agenda do painel; tem prioridade sobre o nome vindo do WhatsApp
  contactName: string | null
  lastBody: string | null
  lastType: string
  lastFromMe: boolean
  lastSentAt: string
}

export type ChatPage = Paginated<ChatSummary>

export interface StoredMessage {
  // bigint do Postgres chega como string
  id: string
  messageId: string
  chatId: string
  chatName: string | null
  fromMe: boolean
  author: string | null
  senderName: string | null
  type: string
  body: string | null
  hasMedia: boolean
  mediaMimetype: string | null
  mediaFilename: string | null
  sentAt: string
}

export interface MessagePage {
  items: StoredMessage[]
  nextBeforeId: string | null
  contactName: string | null
}

export interface Contact {
  id: string
  name: string
  phone: string
  createdAt: string
  updatedAt: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export type ContactPage = Paginated<Contact>

export interface ContactInput {
  name: string
  phone: string
}

export interface AuthTokens {
  access_token: string
}

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PanelFile {
  id: string
  name: string
  mimetype: string
  sizeBytes: number
  createdAt: string
}

export interface FilePage extends Paginated<PanelFile> {
  // Limite de upload configurado no servidor (PANEL_MAX_FILE_SIZE)
  limitBytes: number
}

export interface BroadcastListSummary {
  id: string
  name: string
  memberCount: number
  updatedAt: string
}

export type BroadcastListPage = Paginated<BroadcastListSummary>

export interface BroadcastListMember {
  id: string
  name: string
  phone: string
}

export interface BroadcastListDetail {
  id: string
  name: string
  members: BroadcastListMember[]
}

export interface BroadcastListInput {
  name: string
  contactIds: string[]
}

export type BroadcastRunStatus = 'running' | 'done' | 'failed' | 'interrupted' | 'canceled'

export interface BroadcastRun {
  id: string
  sessionId: string
  listId: string | null
  listName: string
  text: string | null
  fileId: string | null
  fileName: string | null
  status: BroadcastRunStatus
  total: number
  sent: number
  failed: number
  // Motivo quando o disparo inteiro para (instância caiu, reinício, cancelado, erro interno)
  error: string | null
  delayMinSeconds: number
  delayMaxSeconds: number
  randomOrder: boolean
  createdAt: string
  finishedAt: string | null
}

export type BroadcastRunPage = Paginated<BroadcastRun>

// Ritmo do disparo: espera sorteada entre min e max segundos; ordem embaralhada
export interface BroadcastPacing {
  minSeconds: number
  maxSeconds: number
  randomOrder: boolean
}

export interface BroadcastInput {
  listId: string
  text: string
  fileId: string | null
  pacing: BroadcastPacing
}

export interface OutgoingMessage {
  text: string
  fileId: string | null
}

export type ReportSituation = 'all' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type RecipientSituation = Exclude<ReportSituation, 'all'>

export interface BroadcastReportSummary {
  id: string
  sessionId: string
  listName: string
  text: string | null
  fileName: string | null
  status: BroadcastRunStatus
  total: number
  sent: number
  failed: number
  delivered: number
  read: number
  played: number
  error: string | null
  createdAt: string
  finishedAt: string | null
}

export interface ReportRecipient {
  position: number
  name: string
  phone: string
  situation: RecipientSituation
  error: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  playedAt: string | null
}

export type ReportRecipientPage = Paginated<ReportRecipient>

export type PanelEvent =
  | { type: 'broadcast_progress'; sessionId: string; run: BroadcastRun }
  | { type: 'broadcast_delivery'; sessionId: string; runId: string }
  | { type: 'status'; sessionId: string; status: SessionStatus }
  | { type: 'message'; sessionId: string; message: StoredMessage }
  | { type: 'history_synced'; sessionId: string; inserted: number }
