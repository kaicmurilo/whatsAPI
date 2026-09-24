import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useRequiredToken } from '../auth/useAuth'
import { notifyAuthExpired } from '../lib/apiClient'
import { openEventStream } from '../lib/eventStream'
import { PANEL_STREAM_URL } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'
import type { PanelEvent } from '../types/api'

// ponytail: invalida e refaz o fetch em vez de mexer no cache na mão — 1 request extra por evento, zero risco de dessincronizar
function applyPanelEvent(queryClient: QueryClient, event: PanelEvent): void {
  switch (event.type) {
    case 'status':
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
      if (event.status === 'qr') queryClient.invalidateQueries({ queryKey: queryKeys.qr(event.sessionId) })
      return
    case 'message':
      queryClient.invalidateQueries({ queryKey: queryKeys.chatsOf(event.sessionId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(event.sessionId, event.message.chatId) })
      return
    case 'broadcast_progress':
      queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastRuns })
      queryClient.invalidateQueries({ queryKey: queryKeys.reportOf(event.run.id) })
      return
    case 'broadcast_delivery':
      // Tique de entregue/lido: relatório aberto atualiza sozinho
      queryClient.invalidateQueries({ queryKey: queryKeys.reportOf(event.runId) })
      return
    case 'history_synced':
      // Importação mexe em vários chats de uma vez: recarrega tudo da instância
      queryClient.invalidateQueries({ queryKey: queryKeys.chatsOf(event.sessionId) })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.allMessages, event.sessionId] })
  }
}

function parsePanelEvent(data: string): PanelEvent | null {
  try {
    return JSON.parse(data) as PanelEvent
  } catch {
    return null
  }
}

export function usePanelEvents(): void {
  const token = useRequiredToken()
  const queryClient = useQueryClient()

  useEffect(() => {
    const controller = new AbortController()
    const onEvent = (data: string) => {
      const event = parsePanelEvent(data)
      if (event) applyPanelEvent(queryClient, event)
    }
    void openEventStream(PANEL_STREAM_URL, token, { onEvent, onUnauthorized: notifyAuthExpired }, controller.signal)
    return () => controller.abort()
  }, [token, queryClient])
}
