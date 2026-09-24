import { ApiError, buildHeaders } from './apiClient'

const RECONNECT_DELAY_MS = 3000

export interface EventStreamHandlers {
  onEvent: (data: string) => void
  onUnauthorized: () => void
}

// Um bloco SSE termina em linha em branco; só o campo `data:` interessa aqui (o tipo vai dentro do JSON)
export function extractEventData(block: string): string | null {
  const dataLines = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
  return dataLines.length > 0 ? dataLines.join('\n') : null
}

async function consumeStream(body: ReadableStream<Uint8Array>, onEvent: (data: string) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const data = extractEventData(block)
      if (data !== null) onEvent(data)
    }
  }
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })

/**
 * EventSource nativo não envia Authorization header, então o stream é lido via fetch.
 * Reconecta sozinho até o signal ser abortado.
 */
export async function openEventStream(url: string, token: string, handlers: EventStreamHandlers, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const response = await fetch(url, { headers: buildHeaders(token), signal })
      if (response.status === 401) throw new ApiError(401, 'unauthorized')
      if (!response.ok || !response.body) throw new Error(`stream HTTP ${response.status}`)
      await consumeStream(response.body, handlers.onEvent)
    } catch (error) {
      if (signal.aborted) return
      if (error instanceof ApiError && error.status === 401) {
        handlers.onUnauthorized()
        return
      }
    }
    await wait(RECONNECT_DELAY_MS, signal)
  }
}
