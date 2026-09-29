import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { queryKeys } from '../lib/queryKeys'
import { deleteSuppressed, fetchSettings, fetchSuppressed, saveSettings } from '../lib/settingsApi'
import type { PageQuery } from '../lib/panelApi'
import type { PanelSettings } from '../types/api'

export function useSettings() {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => fetchSettings(token),
  })
}

export function useSaveSettings() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: PanelSettings) => saveSettings(token, settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings, settings)
    },
  })
}

export function useSuppressed(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.suppressed(query),
    queryFn: () => fetchSuppressed(token, query),
    placeholderData: keepPreviousData,
  })
}

export function useDeleteSuppressed() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSuppressed(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allSuppressed }),
  })
}
