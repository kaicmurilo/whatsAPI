import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import {
  deleteBroadcastList,
  fetchBroadcastList,
  fetchBroadcastLists,
  fetchBroadcastRuns,
  retryBroadcast,
  cancelBroadcast,
  importBroadcastList,
  saveBroadcastList,
  startBroadcast,
} from '../lib/broadcastApi'
import type { PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'
import type { BroadcastInput, BroadcastListInput, ImportRow } from '../types/api'

export function useBroadcastLists(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.broadcastLists(query),
    queryFn: () => fetchBroadcastLists(token, query),
    placeholderData: keepPreviousData,
  })
}

// Todas as listas (até 100) para o seletor do disparo
export function useAllBroadcastLists() {
  const token = useRequiredToken()
  const query = { page: 1, search: '' }
  return useQuery({
    queryKey: [...queryKeys.broadcastLists(query), 'all'],
    queryFn: () => fetchBroadcastLists(token, query, 100),
  })
}

export function useBroadcastList(listId: string | null) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.broadcastList(listId ?? ''),
    queryFn: () => fetchBroadcastList(token, listId as string),
    enabled: listId !== null,
  })
}

interface SaveListInput {
  listId: string | null
  input: BroadcastListInput
}

export function useSaveBroadcastList() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, input }: SaveListInput) => saveBroadcastList(token, listId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastLists }),
  })
}

export function useDeleteBroadcastList() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) => deleteBroadcastList(token, listId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastLists }),
  })
}

interface StartBroadcastInput {
  sessionId: string
  input: BroadcastInput
}

export function useStartBroadcast() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, input }: StartBroadcastInput) => startBroadcast(token, sessionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastRuns }),
  })
}

export function useBroadcastRuns(page: number) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.broadcastRuns(page),
    queryFn: () => fetchBroadcastRuns(token, page),
    placeholderData: keepPreviousData,
  })
}

export function useRetryBroadcast() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => retryBroadcast(token, runId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastRuns }),
  })
}

export function useCancelBroadcast() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => cancelBroadcast(token, runId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastRuns }),
  })
}

interface ImportListInput {
  fileName: string
  rows: ImportRow[]
}

// Importação cria contatos novos também: agenda e listas precisam recarregar
export function useImportBroadcastList() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ fileName, rows }: ImportListInput) => importBroadcastList(token, fileName, rows),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.allBroadcastLists }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allContacts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allChats }),
    ]),
  })
}
