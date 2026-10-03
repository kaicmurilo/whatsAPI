import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { fetchQueuedRecipients, removeQueuedRecipient } from '../lib/broadcastApi'
import type { PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'

export function useQueuedRecipients(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.queue(query),
    queryFn: () => fetchQueuedRecipients(token, query),
    placeholderData: keepPreviousData,
  })
}

export function useRemoveQueuedRecipient() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, position }: { runId: string; position: number }) => removeQueuedRecipient(token, runId, position),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allQueue })
      queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastRuns })
    },
  })
}
