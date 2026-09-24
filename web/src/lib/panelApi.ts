import type { AuthTokens, ChatPage, Contact, ContactInput, ContactPage, MessagePage, OutgoingMessage, WhatsAppSession } from '../types/api'
import { requestData, requestRaw } from './apiClient'

export const CHATS_PER_PAGE = 20
export const TABLE_PER_PAGE = 5
export const CONTACTS_PER_PAGE = 5
// Seletor de contatos da lista de transmissão: página maior para marcar vários de uma vez
export const CONTACT_PICKER_PER_PAGE = 50
export const MESSAGES_PER_PAGE = 50

export interface PageQuery {
  page: number
  search: string
}

export type ChatQuery = PageQuery

export function pageParams({ page, search }: PageQuery, perPage: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) })
  if (search) params.set('search', search)
  return params
}

export const sessionPath = (sessionId: string) => `/panel/sessions/${encodeURIComponent(sessionId)}`

export function authenticate(userId: string, userSecret: string): Promise<AuthTokens> {
  return requestData<AuthTokens>('/auth/authenticate', {
    method: 'POST',
    body: { user_id: userId, user_secret: userSecret },
  })
}

export function fetchSessions(token: string): Promise<WhatsAppSession[]> {
  return requestData<WhatsAppSession[]>('/panel/sessions', { token })
}

export function fetchChats(token: string, sessionId: string, query: ChatQuery): Promise<ChatPage> {
  return requestData<ChatPage>(`${sessionPath(sessionId)}/chats?${pageParams(query, CHATS_PER_PAGE)}`, { token })
}

// Com arquivo, o texto vira legenda
export async function sendChatMessage(token: string, sessionId: string, chatId: string, message: OutgoingMessage): Promise<void> {
  await requestRaw(`${sessionPath(sessionId)}/chats/${encodeURIComponent(chatId)}/messages`, {
    token,
    method: 'POST',
    body: message,
  })
}

// Confirma que o número tem WhatsApp e devolve o chatId canônico
export async function resolveChatId(token: string, sessionId: string, phone: string): Promise<string> {
  const data = await requestData<{ chatId: string }>(`${sessionPath(sessionId)}/numbers/${encodeURIComponent(phone)}`, { token })
  return data.chatId
}

export function fetchContacts(token: string, query: PageQuery, perPage = CONTACTS_PER_PAGE): Promise<ContactPage> {
  return requestData<ContactPage>(`/panel/contacts?${pageParams(query, perPage)}`, { token })
}

export function saveContact(token: string, contact: ContactInput): Promise<Contact> {
  return requestData<Contact>('/panel/contacts', { token, method: 'POST', body: contact })
}

export async function deleteContact(token: string, contactId: string): Promise<void> {
  await requestRaw(`/panel/contacts/${encodeURIComponent(contactId)}`, { token, method: 'DELETE' })
}

export function fetchMessages(token: string, sessionId: string, chatId: string, beforeId: string | null): Promise<MessagePage> {
  const params = new URLSearchParams({ limit: String(MESSAGES_PER_PAGE) })
  if (beforeId) params.set('beforeId', beforeId)
  return requestData<MessagePage>(`${sessionPath(sessionId)}/chats/${encodeURIComponent(chatId)}/messages?${params}`, { token })
}

export async function startSession(token: string, sessionId: string): Promise<void> {
  await requestRaw(`/session/start/${encodeURIComponent(sessionId)}`, { token })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// A rota devolve PNG quando há QR e JSON { success: false } quando ainda não há.
// Data URL (PNG de poucos KB) evita gerenciar ciclo de vida de object URLs.
export async function fetchQrImage(token: string, sessionId: string): Promise<string | null> {
  const response = await requestRaw(`/session/qr/${encodeURIComponent(sessionId)}/image`, { token })
  const isImage = response.headers.get('Content-Type')?.startsWith('image/') ?? false
  return isImage ? blobToDataUrl(await response.blob()) : null
}

export const PANEL_STREAM_URL = '/panel/stream'
