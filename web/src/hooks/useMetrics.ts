import { useQuery } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { fetchMetrics, fetchSendQueue } from '../lib/metricsApi'
import { queryKeys } from '../lib/queryKeys'

export function useMetrics() {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: () => fetchMetrics(token),
    staleTime: 30_000,
  })
}

const QUEUE_POLL_MS = 3_000

export function useSendQueue() {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.sendQueue,
    queryFn: () => fetchSendQueue(token),
    refetchInterval: QUEUE_POLL_MS,
    refetchIntervalInBackground: false,
  })
}
