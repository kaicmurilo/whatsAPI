import type { DashboardMetrics } from '../types/api'
import { requestData } from './apiClient'

export function fetchMetrics(token: string): Promise<DashboardMetrics> {
  return requestData<DashboardMetrics>('/panel/metrics', { token })
}
