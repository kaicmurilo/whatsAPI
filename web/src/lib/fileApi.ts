import type { FilePage, PanelFile } from '../types/api'
import { requestData, requestRaw } from './apiClient'
import { pageParams, TABLE_PER_PAGE, type PageQuery } from './panelApi'

export function fetchFiles(token: string, query: PageQuery, perPage = TABLE_PER_PAGE): Promise<FilePage> {
  return requestData<FilePage>(`/panel/files?${pageParams(query, perPage)}`, { token })
}

export function uploadFile(token: string, file: File): Promise<PanelFile> {
  return requestData<PanelFile>('/panel/files', { token, method: 'POST', file })
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  await requestRaw(`/panel/files/${encodeURIComponent(fileId)}`, { token, method: 'DELETE' })
}
