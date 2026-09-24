import { useBroadcastRuns } from '../hooks/useBroadcasts'
import { formatDateTime } from '../lib/format'
import { describePacing } from '../lib/pacing'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { BroadcastRun, BroadcastRunStatus } from '../types/api'
import type { BroadcastRunsSectionProps, DataTableColumn } from '../types/components'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { BroadcastRunActions } from './BroadcastRunActions'
import { Pagination } from './Pagination'

const STATUS_LABELS: Record<BroadcastRunStatus, string> = {
  running: 'Enviando',
  done: 'Concluído',
  failed: 'Falhou',
  interrupted: 'Interrompido',
  canceled: 'Cancelado',
}

const getRunKey = (run: BroadcastRun): string => run.id

const describeContent = (run: BroadcastRun): string =>
  [run.fileName ? `📎 ${run.fileName}` : null, run.text].filter(Boolean).join(' · ') || '—'

const describeRunPacing = (run: BroadcastRun): string =>
  describePacing({ minSeconds: run.delayMinSeconds, maxSeconds: run.delayMaxSeconds, randomOrder: run.randomOrder })

// Status + motivo real quando o disparo inteiro parou (antes aparecia sempre "instância caiu")
function RunStatus({ run }: { run: BroadcastRun }) {
  return (
    <span className="run-status" data-status={run.status}>
      {STATUS_LABELS[run.status]}
      {run.error ? <span className="run-status__reason">{run.error}</span> : null}
    </span>
  )
}

function RunProgress({ run }: { run: BroadcastRun }) {
  const done = run.sent + run.failed
  return (
    <div className="run-progress" title={`${run.sent} enviados, ${run.failed} falhas de ${run.total}`}>
      <div className="run-progress__bar" aria-hidden="true">
        <span className="run-progress__sent" style={{ width: `${(run.sent / run.total) * 100}%` }} />
        <span className="run-progress__failed" style={{ width: `${(run.failed / run.total) * 100}%` }} />
      </div>
      <span className="run-progress__label">{done}/{run.total}{run.failed > 0 ? ` · ${run.failed} falha(s)` : ''}</span>
    </div>
  )
}

const buildRunColumns = (openReportId: string | null, onOpenReport: (runId: string) => void): DataTableColumn<BroadcastRun>[] => [
  { key: 'created', header: 'Quando', render: (run) => <span className="broadcasts__mono">{formatDateTime(run.createdAt)}</span> },
  { key: 'list', header: 'Lista', render: (run) => <span className="broadcasts__strong">{run.listName}</span> },
  {
    key: 'content',
    header: 'Conteúdo',
    render: (run) => (
      <span className="run-content">
        <span className="broadcasts__content">{describeContent(run)}</span>
        <span className="run-content__pacing">⏱ {describeRunPacing(run)}</span>
      </span>
    ),
  },
  { key: 'progress', header: 'Progresso', render: (run) => <RunProgress run={run} /> },
  { key: 'status', header: 'Status', render: (run) => <RunStatus run={run} /> },
  {
    key: 'actions',
    header: 'Ações',
    align: 'end',
    render: (run) => <BroadcastRunActions run={run} isReportOpen={run.id === openReportId} onOpenReport={onOpenReport} />,
  },
]

export function BroadcastRunsSection({ page, openReportId, onPageChange, onOpenReport }: BroadcastRunsSectionProps) {
  const runs = useBroadcastRuns(page)
  const items = runs.data?.items ?? []
  const columns = buildRunColumns(openReportId, onOpenReport)

  return (
    <section className="broadcasts__section" aria-labelledby="runs-title">
      <h2 id="runs-title" className="broadcasts__section-title">Histórico</h2>
      {runs.isError ? <EmptyState title="Não foi possível carregar o histórico">{runs.error.message}</EmptyState> : null}
      {runs.isSuccess && items.length === 0 ? <EmptyState title="Nenhum disparo ainda" /> : null}
      {items.length > 0 ? <DataTable caption="Histórico de disparos" columns={columns} rows={items} getRowKey={getRunKey} isBusy={runs.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={runs.data?.total ?? 0} label="Paginação do histórico" onPageChange={onPageChange} />
    </section>
  )
}
