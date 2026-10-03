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
  // Título do WhatsApp já filtrado (não é o JID cru). Independente da página carregada.
  chatName: string | null
}

export interface Contact {
  id: string
  name: string
  phone: string
  createdAt: string
  updatedAt: string
}

export interface ContactSyncInput {
  sessionIds: string[]
  syncToPhone: boolean
  // Ids escolhidos um a um, ou all + search para todos que casam com a busca da tabela
  contactIds?: string[]
  all?: boolean
  search?: string
}

export type ContactSyncStatus = 'running' | 'done' | 'stopped' | 'failed'

export interface ContactSyncError {
  name: string
  sessionId: string
  error: string
}

export interface ContactSyncJob {
  status: ContactSyncStatus
  sessionIds: string[]
  syncToPhone: boolean
  // contacts × instâncias = total de salvamentos
  contacts: number
  total: number
  processed: number
  saved: number
  // Já estavam salvos na conta: pulados sem chamar o WhatsApp
  skipped: number
  failed: number
  lostSessions: string[]
  errors: ContactSyncError[]
  error: string | null
  startedAt: string
  finishedAt: string | null
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

// Canal do disparo: WhatsApp (instâncias) ou Telegram (bot do usuário)
export type BroadcastChannel = 'whatsapp' | 'telegram'

export type BroadcastRunStatus = 'scheduled' | 'running' | 'paused' | 'awaiting' | 'done' | 'failed' | 'interrupted' | 'canceled'

export interface BroadcastRun {
  id: string
  channel: BroadcastChannel
  sessionId: string
  // Instâncias do rodízio. A primeira é sessionId.
  sessionIds: string[]
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
  // Disparo feito a partir de um modelo (nome guardado; o modelo pode ter mudado depois)
  templateName: string | null
  // Envio programado: quando vai sair (status 'scheduled' até lá)
  scheduledAt: string | null
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

// Conteúdo do disparo: modelo salvo OU texto/arquivo avulso
// Conteúdo do disparo: modelo salvo OU texto/arquivo avulso; scheduledAt (ISO) programa em vez de enviar agora
export type BroadcastInput = { listId: string; channel: BroadcastChannel; pacing: BroadcastPacing; scheduledAt?: string; sessionIds: string[] } & (
  | { templateId: string }
  | { text: string; fileId: string | null }
)

export interface TemplateFile {
  id: string
  name: string
  mimetype: string
  sizeBytes: number
}

export interface MessageTemplateSummary {
  id: string
  name: string
  text: string | null
  audioAsVoice: boolean
  attachmentCount: number
  variationCount: number
  updatedAt: string
}

export type MessageTemplatePage = Paginated<MessageTemplateSummary>

export interface MessageTemplateDetail {
  id: string
  name: string
  text: string | null
  variations: string[]
  audioAsVoice: boolean
  files: TemplateFile[]
}

export interface TemplateInput {
  name: string
  text: string
  variations: string[]
  audioAsVoice: boolean
  fileIds: string[]
}

export interface OutgoingMessage {
  text: string
  fileId: string | null
}

export type ReportSituation = 'all' | 'pending' | 'awaiting_reply' | 'suppressed' | 'duplicate' | 'replied' | 'removed' | 'sent' | 'delivered' | 'read' | 'failed'
export type RecipientSituation = Exclude<ReportSituation, 'all'>

export interface BroadcastReportSummary {
  id: string
  channel: BroadcastChannel
  sessionId: string
  listName: string
  text: string | null
  fileName: string | null
  status: BroadcastRunStatus
  total: number
  sent: number
  failed: number
  awaiting: number
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

// Contato pendente de um disparo aberto (menu Fila)
export interface QueuedRecipient {
  runId: string
  position: number
  name: string
  phone: string
  listName: string
  channel: BroadcastChannel
  runStatus: BroadcastRunStatus
}

export type QueuedRecipientPage = Paginated<QueuedRecipient>

export interface SendQueueSnapshot {
  queued: number
  sending: boolean
  nextSendAt: string | null
  remaining: number
}

export type PanelEvent =
  | { type: 'broadcast_progress'; sessionId: string; run: BroadcastRun }
  | { type: 'broadcast_delivery'; sessionId: string; runId: string }
  | { type: 'status'; sessionId: string; status: SessionStatus }
  | { type: 'message'; sessionId: string; message: StoredMessage }
  | { type: 'history_synced'; sessionId: string; inserted: number }

export interface ImportRow {
  name: string
  phoneText: string
}

export interface ListImportResult {
  list: { id: string; name: string; memberCount: number }
  createdContacts: number
  reusedContacts: number
  totalRows: number
  duplicates: number
  skipped: { row: number; reason: string }[]
}

export interface PanelSettings {
  suppressionEnabled: boolean
  suppressionKeywords: string[]
  stopOnReply: boolean
  prependFirstName: boolean
  dailyCapEnabled: boolean
  dailyCap: number
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
}

// Instância que envia disparo: número do WhatsApp ou bot do Telegram. label substitui o id na tela.
export type SenderInstance = Pick<WhatsAppSession, 'sessionId' | 'status' | 'phone' | 'pushName'> & { label?: string }

// Instância do Telegram: bot ("telegram:<id>", fala com quem abriu o bot) ou conta de usuário ("tguser:<id>", envia por telefone).
// Token e sessão nunca voltam para o navegador.
export interface TelegramInstance extends SenderInstance {
  kind: 'bot' | 'account'
  label: string
  // Só bot: @username e contatos que abriram o bot e compartilharam o telefone
  username?: string
  linkedContacts: number | null
  // Só conta: em pausa pelo limite do Telegram até esta hora (fora do rodízio de todos os disparos)
  cooldownUntil?: string | null
  createdAt: string
}

// Login da conta: o Telegram pede o código e, se houver verificação em duas etapas, a senha
export type TelegramLoginStep = { needs: 'code' | 'password' } | { instance: TelegramInstance }

export interface SuppressedNumber {
  id: string
  phone: string
  keyword: string
  requestedAt: string
}

export type MetricPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'all'

export interface MetricBucket {
  sent: number
  delivered: number
  read: number
  played: number
  replied: number
  uniquePhones: number
  failed: number
  suppressed: number
  optOuts: number
  campaigns: number
}

export interface InstanceMetricSlice {
  sent: number
  delivered: number
  read: number
  replied: number
}

export interface InstanceMetrics {
  sessionId: string
  periods: Record<MetricPeriod, InstanceMetricSlice>
}

export interface DailyMetric {
  day: string
  sent: number
  delivered: number
  read: number
  replied: number
}

export interface DashboardMetrics {
  timeZone: string
  replyWindowDays: number
  generatedAt: string
  periods: Record<MetricPeriod, MetricBucket>
  instances: InstanceMetrics[]
  daily: DailyMetric[]
  snapshot: { running: number; paused: number; scheduled: number }
}
