import { useQrImageUrl } from '../hooks/useQrImageUrl'
import { awaitsQrScan } from '../lib/sessionStatus'
import type { QrCardProps } from '../types/components'
import { StatusLamp } from './StatusLamp'

export function QrCard({ session }: QrCardProps) {
  const qrUrl = useQrImageUrl(session.sessionId, awaitsQrScan(session.status))

  return (
    <section className="qr-card" aria-labelledby="qr-card-title">
      <StatusLamp status={session.status} showLabel />
      <h2 id="qr-card-title" className="qr-card__title">Conecte {session.sessionId}</h2>
      <div className="qr-card__frame">
        {qrUrl ? <img src={qrUrl} width={264} height={264} alt="QR code para conectar o WhatsApp" /> : <span className="qr-card__wait">Gerando QR…</span>}
      </div>
      <ol className="qr-card__steps">
        <li>Abra o WhatsApp no celular</li>
        <li>Aparelhos conectados → Conectar um aparelho</li>
        <li>Aponte a câmera para este código</li>
      </ol>
    </section>
  )
}
