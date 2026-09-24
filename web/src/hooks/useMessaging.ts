import { useMutation } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { resolveChatId, sendChatMessage } from '../lib/panelApi'
import type { OutgoingMessage } from '../types/api'

interface SendMessageInput {
  sessionId: string
  chatId: string
  message: OutgoingMessage
}

interface ResolveChatInput {
  sessionId: string
  phone: string
}

// Sem invalidação manual: a mensagem enviada volta pelo SSE (message_create) e atualiza a conversa
export function useSendMessage() {
  const token = useRequiredToken()
  return useMutation({
    mutationFn: ({ sessionId, chatId, message }: SendMessageInput) => sendChatMessage(token, sessionId, chatId, message),
  })
}

export function useResolveChat() {
  const token = useRequiredToken()
  return useMutation({
    mutationFn: ({ sessionId, phone }: ResolveChatInput) => resolveChatId(token, sessionId, phone),
  })
}
