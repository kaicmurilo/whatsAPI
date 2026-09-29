import { useQuery } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { fetchMetrics } from '../lib/metricsApi'
import { queryKeys } from '../lib/queryKeys'

export function useMetrics() {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: () => fetchMetrics(token),
    staleTime: 30_000,
  })
}
