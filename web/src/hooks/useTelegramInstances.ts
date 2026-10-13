import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { queryKeys } from '../lib/queryKeys'
import {
  continueTelegramLogin, createTelegramBot, deleteTelegramInstance, fetchTelegramInstances, retryTelegramAccount, startTelegramLogin,
  type TelegramLoginAnswer, type TelegramLoginStart,
} from '../lib/telegramApi'

// Status, vinculados e pausa por limite mudam no servidor (nova tentativa automática): atualiza a cada minuto
const INSTANCES_REFRESH_MS = 60 * 1000

export function useTelegramInstances() {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.telegramInstances,
    queryFn: () => fetchTelegramInstances(token),
    refetchInterval: INSTANCES_REFRESH_MS,
  })
}

// Qualquer mudança nas instâncias recarrega a lista (barra lateral e seletor de disparo)
function useInstancesMutation<TInput, TResult>(mutate: (token: string, input: TInput) => Promise<TResult>) {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => mutate(token, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.telegramInstances }),
  })
}

export const useCreateTelegramBot = () => useInstancesMutation(createTelegramBot)

export const useDeleteTelegramInstance = () => useInstancesMutation(deleteTelegramInstance)

export const useRetryTelegramAccount = () => useInstancesMutation(retryTelegramAccount)

export function useStartTelegramLogin() {
  const token = useRequiredToken()
  return useMutation({ mutationFn: (input: TelegramLoginStart) => startTelegramLogin(token, input) })
}

export const useContinueTelegramLogin = () =>
  useInstancesMutation((token: string, { loginId, answer }: { loginId: string; answer: TelegramLoginAnswer }) => continueTelegramLogin(token, loginId, answer))
