import { useDownloadSendReport, useSendReport } from '../hooks/useBroadcastReport'
import { formatDateTime, formatPhone } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import { SITUATION_LABELS } from '../lib/recipientSituation'
import type { SendReportRow } from '../types/api'
import type { DataTableColumn, SendReportSectionProps } from '../types/components'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const rowKeyOf = (row: SendReportRow): string => `${row.runId}:${row.position}`

const statusLabelOf = (row: SendReportRow): string => (row.status === 'scheduled' ? 'Agendado' : SITUATION_LABELS[row.status])

// Já enviado: data real; ainda não: a previsão do disparo programado
function SendTimeCell({ row }: { row: SendReportRow }) {
  if (row.sentAt) return <span className="broadcasts__mono">{formatDateTime(row.sentAt)}</span>
  if (row.scheduledAt) return <span className="broadcasts__mono">{formatDateTime(row.scheduledAt)} <span className="run-status__reason">previsto</span></span>
  return <span className="broadcasts__mono">—</span>
}

const SEND_REPORT_COLUMNS: DataTableColumn<SendReportRow>[] = [
  { key: 'list', header: 'Lista', render: (row) => <span className="broadcasts__strong">{row.listName}</span> },
  { key: 'phone', header: 'Número', render: (row) => <span className="contacts__phone" title={row.name}>{formatPhone(row.phone)}</span> },
  { key: 'message', header: 'Mensagem', render: (row) => <span className="send-report__message" title={row.message ?? undefined}>{row.message ?? '—'}</span> },
  { key: 'created', header: 'Agendado em', render: (row) => <span className="broadcasts__mono">{formatDateTime(row.createdAt)}</span> },
  { key: 'sent', header: 'Envio', render: (row) => <SendTimeCell row={row} /> },
  { key: 'status', header: 'Situação', render: (row) => <span className="report-situation" data-situation={row.status}>{statusLabelOf(row)}</span> },
]

// Relatório geral: todos os números de todas as listas, com mensagem, quando foi agendado e quando sai/saiu
export function SendReportSection({ page, search, onPageChange, onSearchChange }: SendReportSectionProps) {
  const report = useSendReport({ page, search })
  const rows = report.data?.items ?? []
  const download = useDownloadSendReport()

  return (
    <section className="broadcasts__section" aria-labelledby="send-report-title">
      <header className="broadcasts__section-header">
        <h2 id="send-report-title" className="broadcasts__section-title">Relatório de envios</h2>
        <button type="button" className="report__download" disabled={download.isPending || rows.length === 0} onClick={() => download.mutate(search)}>
          {download.isPending ? 'Gerando…' : 'Baixar CSV'}
        </button>
      </header>
      <p className="run-status__reason">{report.data?.total ?? 0} números de todas as listas · agendados mostram a data prevista de envio</p>
      {download.isError ? <p className="broadcast-send__error" role="alert">{download.error.message}</p> : null}
      <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar por lista, nome ou número" label="Buscar no relatório" />
      {report.isError ? <EmptyState title="Não foi possível carregar o relatório">{report.error.message}</EmptyState> : null}
      {report.isSuccess && rows.length === 0 ? <EmptyState title={search ? 'Nenhum número encontrado' : 'Nenhum envio ainda'} /> : null}
      {rows.length > 0 ? <DataTable caption="Relatório de envios" columns={SEND_REPORT_COLUMNS} rows={rows} getRowKey={rowKeyOf} isBusy={report.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={report.data?.total ?? 0} label="Paginação do relatório de envios" onPageChange={onPageChange} />
    </section>
  )
}
