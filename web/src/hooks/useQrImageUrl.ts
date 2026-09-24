import { useQuery } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { fetchQrImage } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'

// O WhatsApp renova o QR ~a cada 20s; o evento SSE "status: qr" invalida esta query.
// O refetch periódico cobre o caso do stream cair.
const QR_REFRESH_MS = 15000

export function useQrImageUrl(sessionId: string, enabled: boolean): string | null {
  const token = useRequiredToken()
  const { data } = useQuery({
    queryKey: queryKeys.qr(sessionId),
    queryFn: () => fetchQrImage(token, sessionId),
    enabled,
    refetchInterval: enabled ? QR_REFRESH_MS : false,
  })
  return data ?? null
}
