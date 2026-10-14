import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { fetchGroups, type PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'

export function useGroups(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.groups(query),
    queryFn: () => fetchGroups(token, query),
    placeholderData: keepPreviousData,
  })
}
