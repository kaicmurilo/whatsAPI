import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { fetchChats, fetchMessages, fetchSessions, startSession, type ChatQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'

export function useSessions() {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => fetchSessions(token),
  })
}

export function useChats(sessionId: string | null, query: ChatQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.chats(sessionId ?? '', query),
    queryFn: () => fetchChats(token, sessionId as string, query),
    enabled: sessionId !== null,
    placeholderData: keepPreviousData,
  })
}

export function useMessages(sessionId: string | null, chatId: string | null) {
  const token = useRequiredToken()
  return useInfiniteQuery({
    queryKey: queryKeys.messages(sessionId ?? '', chatId ?? ''),
    queryFn: ({ pageParam }) => fetchMessages(token, sessionId as string, chatId as string, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextBeforeId,
    enabled: sessionId !== null && chatId !== null,
  })
}

export function useStartSession() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => startSession(token, sessionId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  })
}
