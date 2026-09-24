import type {
  BroadcastInput,
  BroadcastListDetail,
  BroadcastListInput,
  BroadcastListPage,
  BroadcastListSummary,
  BroadcastRun,
  BroadcastRunPage,
  BroadcastReportSummary,
  ReportRecipientPage,
  ReportSituation,
} from '../types/api'
import { requestData, requestRaw } from './apiClient'
import { pageParams, sessionPath, TABLE_PER_PAGE, type PageQuery } from './panelApi'

const listPath = (listId: string) => `/panel/broadcast-lists/${encodeURIComponent(listId)}`

export function fetchBroadcastLists(token: string, query: PageQuery, perPage = TABLE_PER_PAGE): Promise<BroadcastListPage> {
  return requestData<BroadcastListPage>(`/panel/broadcast-lists?${pageParams(query, perPage)}`, { token })
}

export function fetchBroadcastList(token: string, listId: string): Promise<BroadcastListDetail> {
  return requestData<BroadcastListDetail>(listPath(listId), { token })
}

// listId null cria; com id substitui nome e membros
export function saveBroadcastList(token: string, listId: string | null, input: BroadcastListInput): Promise<BroadcastListSummary> {
  return listId
    ? requestData<BroadcastListSummary>(listPath(listId), { token, method: 'PUT', body: input })
    : requestData<BroadcastListSummary>('/panel/broadcast-lists', { token, method: 'POST', body: input })
}

export async function deleteBroadcastList(token: string, listId: string): Promise<void> {
  await requestRaw(listPath(listId), { token, method: 'DELETE' })
}

export function startBroadcast(token: string, sessionId: string, input: BroadcastInput): Promise<BroadcastRun> {
  return requestData<BroadcastRun>(`${sessionPath(sessionId)}/broadcasts`, { token, method: 'POST', body: input })
}

export function fetchBroadcastRuns(token: string, page: number): Promise<BroadcastRunPage> {
  return requestData<BroadcastRunPage>(`/panel/broadcasts?${pageParams({ page, search: '' }, TABLE_PER_PAGE)}`, { token })
}

// Reenvia só para quem ainda não recebeu, no mesmo registro de histórico
export function retryBroadcast(token: string, runId: string): Promise<BroadcastRun> {
  return requestData<BroadcastRun>(`/panel/broadcasts/${encodeURIComponent(runId)}/retry`, { token, method: 'POST' })
}

const reportPath = (runId: string) => `/panel/broadcasts/${encodeURIComponent(runId)}/report`

export function fetchBroadcastReport(token: string, runId: string): Promise<BroadcastReportSummary> {
  return requestData<BroadcastReportSummary>(reportPath(runId), { token })
}

export function fetchReportRecipients(token: string, runId: string, page: number, situation: ReportSituation): Promise<ReportRecipientPage> {
  const params = new URLSearchParams({ page: String(page), perPage: String(TABLE_PER_PAGE), situation })
  return requestData<ReportRecipientPage>(`${reportPath(runId)}/recipients?${params}`, { token })
}

export interface ReportFile {
  blob: Blob
  fileName: string
}

const FILE_NAME_PATTERN = /filename="([^"]+)"/

// CSV vem autenticado (Bearer), então não dá para usar <a href> direto: baixa como blob
export async function downloadReportCsv(token: string, runId: string): Promise<ReportFile> {
  const response = await requestRaw(`/panel/broadcasts/${encodeURIComponent(runId)}/report.csv`, { token })
  const fileName = FILE_NAME_PATTERN.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? `relatorio-${runId}.csv`
  return { blob: await response.blob(), fileName }
}

// Para antes do próximo contato; quem não recebeu fica pendente (pode reprocessar depois)
export async function cancelBroadcast(token: string, runId: string): Promise<void> {
  await requestRaw(`/panel/broadcasts/${encodeURIComponent(runId)}/cancel`, { token, method: 'POST' })
}
