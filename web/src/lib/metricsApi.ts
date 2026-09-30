import type { DashboardMetrics, SendQueueSnapshot } from '../types/api'
import { requestData } from './apiClient'

export function fetchSendQueue(token: string): Promise<SendQueueSnapshot> {
  return requestData<SendQueueSnapshot>('/panel/broadcasts/queue', { token })
}

export function fetchMetrics(token: string): Promise<DashboardMetrics> {
  return requestData<DashboardMetrics>('/panel/metrics', { token })
}
