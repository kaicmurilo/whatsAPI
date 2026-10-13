import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { downloadReportCsv, fetchBroadcastReport, fetchReportRecipients, fetchSendReport, downloadSendReportCsv, refreshBroadcastReport } from '../lib/broadcastApi'
import type { PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'
import type { ReportSituation } from '../types/api'

export function useBroadcastReport(runId: string) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.reportOf(runId),
    queryFn: () => fetchBroadcastReport(token, runId),
  })
}

export function useReportRecipients(runId: string, page: number, situation: ReportSituation) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.reportRecipients(runId, page, situation),
    queryFn: () => fetchReportRecipients(token, runId, page, situation),
    placeholderData: keepPreviousData,
  })
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function useDownloadReport() {
  const token = useRequiredToken()
  return useMutation({
    mutationFn: (runId: string) => downloadReportCsv(token, runId),
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
  })
}

export function useRefreshReport(runId: string) {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshBroadcastReport(token, runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reportOf(runId) }),
  })
}

// Relatório geral (todas as listas); a chave fica sob broadcast-runs para atualizar junto quando um disparo muda
export function useSendReport(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.sendReport(query),
    queryFn: () => fetchSendReport(token, query),
    placeholderData: keepPreviousData,
  })
}

export function useDownloadSendReport() {
  const token = useRequiredToken()
  return useMutation({
    mutationFn: (search: string) => downloadSendReportCsv(token, search),
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
  })
}
