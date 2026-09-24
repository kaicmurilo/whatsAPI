import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { downloadReportCsv, fetchBroadcastReport, fetchReportRecipients } from '../lib/broadcastApi'
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
