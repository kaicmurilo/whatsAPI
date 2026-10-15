import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { addGroupMembers, fetchGroupCacheStatus, fetchGroups, refreshGroups, type PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'

export function useGroups(query: PageQuery, perPage: number) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.groups(query, perPage),
    queryFn: () => fetchGroups(token, query, perPage),
    placeholderData: keepPreviousData,
  })
}

export function useGroupCacheStatus() {
  const token = useRequiredToken()
  return useQuery({ queryKey: queryKeys.groupStatus, queryFn: () => fetchGroupCacheStatus(token) })
}

export function useRefreshGroups() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshGroups(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allGroups }),
  })
}

export function useAddGroupMembers(chatId: string) {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionIds: string[]) => addGroupMembers(token, chatId, sessionIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allGroups }),
  })
}
