import type { ApiEnvelope } from '../types/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Disparado quando uma chamada autenticada volta 401; o AuthProvider escuta e faz logout
export const AUTH_EXPIRED_EVENT = 'whatsapi:auth-expired'

export const notifyAuthExpired = (): void => {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

interface RequestOptions {
  token?: string | null
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  // JSON
  body?: unknown
  // Upload: bytes crus; nome e tipo vão em headers (a API espera application/octet-stream)
  file?: File
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiEnvelope<unknown>
    return payload.error ?? payload.message ?? response.statusText
  } catch {
    return response.statusText
  }
}

export function buildHeaders(token?: string | null, hasBody = false): HeadersInit {
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const fileHeaders = (file: File): HeadersInit => ({
  'Content-Type': 'application/octet-stream',
  'X-File-Name': encodeURIComponent(file.name),
  'X-File-Type': file.type || 'application/octet-stream',
})

function buildRequestInit({ token, method = 'GET', body, file }: RequestOptions): RequestInit {
  if (file) return { method, body: file, headers: { ...buildHeaders(token), ...fileHeaders(file) } }
  return {
    method,
    headers: buildHeaders(token, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

export async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await fetch(path, buildRequestInit(options))
  if (response.status === 401 && options.token) notifyAuthExpired()
  if (!response.ok) throw new ApiError(response.status, await readErrorMessage(response))
  return response
}

// A API responde sempre no envelope { success, data } — desembrulha ou falha
export async function requestData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestRaw(path, options)
  const payload = (await response.json()) as ApiEnvelope<T>
  if (!payload.success) throw new ApiError(response.status, payload.error ?? payload.message ?? 'Falha na requisição')
  return payload.data as T
}
