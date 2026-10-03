import type { ContactSyncStatus } from '../types/api'
import type { ContactSyncProgressProps } from '../types/components'

const STATUS_LABELS: Record<ContactSyncStatus, string> = {
  running: 'Salvando no WhatsApp…',
  done: 'Sincronização concluída',
  stopped: 'Sincronização parada',
  failed: 'Sincronização falhou',
}

export function ContactSyncProgress({ job }: ContactSyncProgressProps) {
  return (
    <div className="contact-sync__progress" role="status" data-status={job.status}>
      <p className="contact-sync__status">{STATUS_LABELS[job.status]}</p>
      <progress className="contact-sync__bar" value={job.processed} max={Math.max(job.total, 1)} />
      <p className="contact-sync__counts">
        {job.processed} de {job.total} salvamentos ({job.contacts} contatos × {job.sessionIds.length} instâncias) · {job.saved} salvos · {job.skipped} já estavam salvos · {job.failed} falhas
      </p>
      {job.error ? <p className="contact-sync__error" role="alert">{job.error}</p> : null}
      {job.errors.length > 0 ? (
        <ul className="contact-sync__errors" aria-label="Últimas falhas">
          {job.errors.map((failure, index) => (
            <li key={`${failure.sessionId}-${index}`}>{failure.name} em {failure.sessionId}: {failure.error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
