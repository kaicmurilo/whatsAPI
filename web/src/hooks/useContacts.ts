import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { CONTACTS_PER_PAGE, deleteContact, fetchContacts, saveContact, type PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'
import type { ContactInput } from '../types/api'

// O nome da agenda aparece na lista de chats e no título da conversa: tudo precisa refazer o fetch
function invalidateContactViews(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.allContacts }),
    queryClient.invalidateQueries({ queryKey: queryKeys.allChats }),
    queryClient.invalidateQueries({ queryKey: queryKeys.allMessages }),
    queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastLists }),
  ])
}

export function useContacts(query: PageQuery, perPage = CONTACTS_PER_PAGE) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.contacts(query, perPage),
    queryFn: () => fetchContacts(token, query, perPage),
    placeholderData: keepPreviousData,
  })
}

export function useSaveContact() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contact: ContactInput) => saveContact(token, contact),
    onSuccess: () => invalidateContactViews(queryClient),
  })
}

export function useDeleteContact() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => deleteContact(token, contactId),
    onSuccess: () => invalidateContactViews(queryClient),
  })
}
