import { useBroadcastReport, useDownloadReport, useRefreshReport, useReportRecipients } from '../hooks/useBroadcastReport'
import { formatDateTime, formatPhone } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { RecipientSituation, ReportRecipient } from '../types/api'
import type { BroadcastReportProps, DataTableColumn } from '../types/components'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { ReportSituationFilter } from './ReportSituationFilter'
import { ReportSummaryCards } from './ReportSummaryCards'

const SITUATION_LABELS: Record<RecipientSituation, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  failed: 'Falhou',
}

const optionalTime = (value: string | null) => (value ? formatDateTime(value) : '—')
const getRecipientKey = (recipient: ReportRecipient): string => String(recipient.position)

const timeCell = (value: string | null) => <span className="broadcasts__mono">{optionalTime(value)}</span>

const RECIPIENT_COLUMNS: DataTableColumn<ReportRecipient>[] = [
  { key: 'name', header: 'Contato', render: (recipient) => <span className="broadcasts__strong">{recipient.name}</span> },
  { key: 'phone', header: 'Telefone', render: (recipient) => <span className="broadcasts__mono">{formatPhone(recipient.phone)}</span> },
  {
    key: 'situation',
    header: 'Situação',
    render: (recipient) => (
      <span className="report-situation" data-situation={recipient.situation} title={recipient.error ?? undefined}>
        {SITUATION_LABELS[recipient.situation]}
        {recipient.error ? <span className="run-status__reason">{recipient.error}</span> : null}
      </span>
    ),
  },
  { key: 'sent', header: 'Enviado', render: (recipient) => timeCell(recipient.sentAt) },
  { key: 'delivered', header: 'Entregue', render: (recipient) => timeCell(recipient.deliveredAt) },
  { key: 'read', header: 'Lido', render: (recipient) => timeCell(recipient.readAt) },
  { key: 'played', header: 'Reproduzido', render: (recipient) => timeCell(recipient.playedAt) },
]

export function BroadcastReport({ runId, page, situation, onClose, onPageChange, onSituationChange }: BroadcastReportProps) {
  const summary = useBroadcastReport(runId)
  const recipients = useReportRecipients(runId, page, situation)
  const download = useDownloadReport()
  const refresh = useRefreshReport(runId)
  const items = recipients.data?.items ?? []
  const refreshMessage = refresh.isSuccess
    ? `${refresh.data.checked} mensagem(ns) consultada(s), ${refresh.data.updated} atualizada(s).`
    : null

  if (summary.isError) {
    return (
      <section className="report">
        <EmptyState title="Não foi possível abrir o relatório">{summary.error.message}</EmptyState>
        <button type="button" className="report__close" onClick={onClose}>Fechar</button>
      </section>
    )
  }
  if (!summary.data) return <p className="list-editor__loading">Carregando relatório…</p>

  const run = summary.data
  return (
    <section className="report" aria-labelledby="report-title">
      <header className="report__header">
        <div>
          <p className="library__eyebrow">Relatório</p>
          <h2 id="report-title" className="report__title">{run.listName}</h2>
          <p className="report__meta">
            Disparo em {formatDateTime(run.createdAt)} · {run.fileName ? `📎 ${run.fileName}` : 'texto'}
            {run.text ? ` · “${run.text.slice(0, 80)}${run.text.length > 80 ? '…' : ''}”` : ''}
          </p>
        </div>
        <div className="report__actions">
          <button type="button" className="report__refresh" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            {refresh.isPending ? 'Consultando…' : 'Atualizar tiques'}
          </button>
          <button type="button" className="report__download" disabled={download.isPending} onClick={() => download.mutate(runId)}>
            {download.isPending ? 'Gerando…' : 'Baixar CSV'}
          </button>
          <button type="button" className="report__close" onClick={onClose} aria-label="Fechar relatório">×</button>
        </div>
      </header>
      {download.isError ? <p className="broadcast-send__error" role="alert">{download.error.message}</p> : null}
      {refresh.isError ? <p className="broadcast-send__error" role="alert">{refresh.error.message}</p> : null}
      {refreshMessage ? <p className="broadcast-send__ok" role="status">{refreshMessage}</p> : null}

      <ReportSummaryCards summary={run} />
      <p className="report__note">
        Entregue, lido e reproduzido chegam pelos tiques do WhatsApp. Com a instância desligada, os tiques são
        recuperados ao reconectar (ou em “Atualizar tiques”). “Lido” só aparece para quem mantém a confirmação de leitura ligada.
      </p>

      <ReportSituationFilter value={situation} onChange={onSituationChange} />
      {recipients.isSuccess && items.length === 0 ? <EmptyState title="Ninguém nesta situação" /> : null}
      {items.length > 0 ? (
        <DataTable caption="Destinatários do disparo" columns={RECIPIENT_COLUMNS} rows={items} getRowKey={getRecipientKey} isBusy={recipients.isFetching} />
      ) : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={recipients.data?.total ?? 0} label="Paginação dos destinatários" onPageChange={onPageChange} />
    </section>
  )
}
