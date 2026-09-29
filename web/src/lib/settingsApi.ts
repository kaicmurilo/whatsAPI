import type { Paginated, PanelSettings, SuppressedNumber } from '../types/api'
import { pageParams, type PageQuery } from './panelApi'
import { requestData, requestRaw } from './apiClient'

export const SUPPRESSION_PER_PAGE = 20

export function fetchSettings(token: string): Promise<PanelSettings> {
  return requestData<PanelSettings>('/panel/settings', { token })
}

export function saveSettings(token: string, settings: PanelSettings): Promise<PanelSettings> {
  return requestData<PanelSettings>('/panel/settings', { token, method: 'PUT', body: settings })
}

export async function fetchSuppressed(token: string, query: PageQuery): Promise<Paginated<SuppressedNumber>> {
  const page = await requestData<Paginated<SuppressedNumber>>(`/panel/suppression?${pageParams(query, SUPPRESSION_PER_PAGE)}`, { token })
  return {
    ...page,
    items: page.items.map((item) => ({ ...item, id: String(item.id) })),
  }
}

export async function deleteSuppressed(token: string, id: string): Promise<void> {
  await requestRaw(`/panel/suppression/${encodeURIComponent(id)}`, { token, method: 'DELETE' })
}
