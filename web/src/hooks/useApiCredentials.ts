import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { createCredential, fetchCredentials, revokeCredential, updateCredentialSessions } from '../lib/credentialApi'
import type { PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'
import type { NewApiCredential } from '../types/api'

export function useApiCredentials(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.credentials(query),
    queryFn: () => fetchCredentials(token, query),
    placeholderData: keepPreviousData,
  })
}

export function useCreateApiCredential() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credential: NewApiCredential) => createCredential(token, credential),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allCredentials }),
  })
}

export function useUpdateCredentialSessions(id: string) {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionIds: string[] | null) => updateCredentialSessions(token, id, sessionIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allCredentials }),
  })
}

export function useRevokeApiCredential() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeCredential(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allCredentials }),
  })
}
