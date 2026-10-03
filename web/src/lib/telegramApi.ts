import type { TelegramInstance, TelegramLoginStep } from '../types/api'
import { requestData, requestRaw } from './apiClient'

const TELEGRAM_PATH = '/panel/telegram'

export interface TelegramLoginStart {
  phone: string
  apiId: string
  apiHash: string
}

export interface TelegramLoginAnswer {
  code?: string
  password?: string
}

// "telegram:123" → rota do bot; "tguser:456" → rota da conta
const deletePathOf = (instanceId: string): string => {
  const [prefix, id] = instanceId.split(':')
  return `${TELEGRAM_PATH}/${prefix === 'tguser' ? 'accounts' : 'bots'}/${encodeURIComponent(id)}`
}

export function fetchTelegramInstances(token: string): Promise<TelegramInstance[]> {
  return requestData<TelegramInstance[]>(`${TELEGRAM_PATH}/instances`, { token })
}

export function createTelegramBot(token: string, botToken: string): Promise<TelegramInstance> {
  return requestData<TelegramInstance>(`${TELEGRAM_PATH}/bots`, { token, method: 'POST', body: { token: botToken } })
}

export async function deleteTelegramInstance(token: string, instanceId: string): Promise<void> {
  await requestRaw(deletePathOf(instanceId), { token, method: 'DELETE' })
}

export function startTelegramLogin(token: string, input: TelegramLoginStart): Promise<{ loginId: string }> {
  return requestData<{ loginId: string }>(`${TELEGRAM_PATH}/accounts`, { token, method: 'POST', body: input })
}

export function continueTelegramLogin(token: string, loginId: string, answer: TelegramLoginAnswer): Promise<TelegramLoginStep> {
  return requestData<TelegramLoginStep>(`${TELEGRAM_PATH}/accounts/login/${encodeURIComponent(loginId)}`, { token, method: 'POST', body: answer })
}
