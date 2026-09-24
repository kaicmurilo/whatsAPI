const GROUP_SUFFIX = '@g.us'

const MEDIA_LABELS: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  ptt: 'Áudio',
  audio: 'Áudio',
  document: 'Documento',
  sticker: 'Figurinha',
  location: 'Localização',
  vcard: 'Contato',
  multi_vcard: 'Contatos',
  revoked: 'Mensagem apagada',
}

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

export const isGroupChat = (chatId: string): boolean => chatId.endsWith(GROUP_SUFFIX)

export const formatPhone = (digits: string): string => `+${digits}`

// "5511999999999@c.us" → "+5511999999999"; grupos e ids sem número ficam como vieram
export function formatChatId(chatId: string): string {
  const [user] = chatId.split('@')
  return /^\d+$/.test(user) && !isGroupChat(chatId) ? formatPhone(user) : chatId
}

// Primeiro nome preenchido vence (agenda antes do WhatsApp); sem nome, mostra o número
export const formatChatTitle = (chatId: string, ...names: (string | null)[]): string =>
  names.find((name) => name?.trim())?.trim() ?? formatChatId(chatId)

export const mediaLabel = (type: string): string | null => MEDIA_LABELS[type] ?? null

export function previewText(type: string, body: string | null): string {
  const label = mediaLabel(type)
  if (label && body) return `${label} · ${body}`
  return label ?? body ?? ''
}

export function formatListTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  return date.toDateString() === now.toDateString() ? timeFormatter.format(date) : dayFormatter.format(date)
}

export const formatMessageTime = (iso: string): string => timeFormatter.format(new Date(iso))

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const formatDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso))

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB']
const BYTES_PER_UNIT = 1000 // decimal, como o Finder e o limite do servidor (50 MB = 50.000.000 B)

export function formatBytes(bytes: number): string {
  const exponent = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(BYTES_PER_UNIT)), BYTE_UNITS.length - 1)
  const value = bytes / BYTES_PER_UNIT ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${BYTE_UNITS[exponent]}`
}

// "application/pdf" → "PDF"; famílias genéricas viram rótulo em português
export function fileKindLabel(mimetype: string): string {
  if (mimetype === 'application/pdf') return 'PDF'
  const family = mimetype.split('/')[0]
  const byFamily: Record<string, string> = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio', text: 'Texto' }
  return byFamily[family] ?? 'Documento'
}
