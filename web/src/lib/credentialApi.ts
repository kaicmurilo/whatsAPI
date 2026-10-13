import type { ApiCredential, CreatedApiCredential, NewApiCredential, Paginated } from '../types/api'
import { requestData, requestRaw } from './apiClient'
import { pageParams, TABLE_PER_PAGE, type PageQuery } from './panelApi'

// bigint do Postgres chega como número/string; a UI trabalha com string
const withStringId = <T extends ApiCredential>(credential: T): T => ({ ...credential, id: String(credential.id) })

export async function fetchCredentials(token: string, query: PageQuery): Promise<Paginated<ApiCredential>> {
  const page = await requestData<Paginated<ApiCredential>>(`/panel/credentials?${pageParams(query, TABLE_PER_PAGE)}`, { token })
  return { ...page, items: page.items.map(withStringId) }
}

export async function createCredential(token: string, credential: NewApiCredential): Promise<CreatedApiCredential> {
  return withStringId(await requestData<CreatedApiCredential>('/panel/credentials', { token, method: 'POST', body: credential }))
}

export async function revokeCredential(token: string, id: string): Promise<void> {
  await requestRaw(`/panel/credentials/${encodeURIComponent(id)}`, { token, method: 'DELETE' })
}
