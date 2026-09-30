import { useBroadcastRuns, useResumeAllBroadcasts } from '../hooks/useBroadcasts'
import { ConfirmButton } from './ConfirmButton'
import { formatDateTime } from '../lib/format'
import { formatSchedule } from '../lib/schedule'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { BroadcastRun, BroadcastRunStatus, WhatsAppSession } from '../types/api'
import type { BroadcastRunsSectionProps, DataTableColumn } from '../types/components'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { BroadcastRunActions } from './BroadcastRunActions'
import { Pagination } from './Pagination'
import { RunInstancesEditor } from './RunInstancesEditor'
import { RunPacingEditor } from './RunPacingEditor'

const STATUS_LABELS: Record<BroadcastRunStatus, string> = {
  scheduled: 'Programado',
  running: 'Enviando',
  paused: 'Pausado',
  awaiting: 'Aguardando respostas',
  done: 'Concluído',
  failed: 'Falhou',
  interrupted: 'Interrompido',
  canceled: 'Cancelado',
}

const getRunKey = (run: BroadcastRun): string => run.id

const describeContent = (run: BroadcastRun): string =>
  run.templateName
    ? `✉ ${run.templateName}`
    : [run.fileName ? `📎 ${run.fileName}` : null, run.text].filter(Boolean).join(' · ') || '—'

// Status + motivo real quando o disparo inteiro parou (antes aparecia sempre "instância caiu")
function RunStatus({ run }: { run: BroadcastRun }) {
  return (
    <span className="run-status" data-status={run.status}>
      {STATUS_LABELS[run.status]}
      {run.status === 'scheduled' && run.scheduledAt ? <span className="run-status__reason">para {formatSchedule(run.scheduledAt)}</span> : null}
      {run.error ? <span className="run-status__reason">{run.error}</span> : null}
    </span>
  )
}

function RunProgress({ run }: { run: BroadcastRun }) {
  if (run.status === 'scheduled') return <span className="run-progress__label">Aguardando horário</span>
  if (run.status === 'awaiting') {
    return (
      <span className="run-progress__label">
        {run.sent}/{run.total} enviados · aguardando respostas
      </span>
    )
  }
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

const buildRunColumns = (
  sessions: WhatsAppSession[],
  openReportId: string | null,
  onOpenReport: (runId: string) => void,
): DataTableColumn<BroadcastRun>[] => [
  { key: 'created', header: 'Quando', render: (run) => <span className="broadcasts__mono">{formatDateTime(run.createdAt)}</span> },
  { key: 'list', header: 'Lista', render: (run) => <span className="broadcasts__strong">{run.listName}</span> },
  {
    key: 'content',
    header: 'Conteúdo',
    render: (run) => (
      <span className="run-content">
        <span className="broadcasts__content">{describeContent(run)}</span>
        <RunInstancesEditor run={run} sessions={sessions} />
        <RunPacingEditor run={run} />
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

function ResumeAllButton() {
  const resumeAll = useResumeAllBroadcasts()
  const resumed = resumeAll.data?.resumed.length ?? 0
  const skipped = resumeAll.data?.skipped ?? []
  return (
    <div className="broadcasts__header-actions">
      <ConfirmButton
        tone="primary"
        label="Retomar todas"
        confirmLabel="Retomar interrompidos e pausados?"
        isPending={resumeAll.isPending}
        onConfirm={() => resumeAll.mutate()}
      />
      {resumeAll.isError ? <span className="run-actions__error" role="alert">{resumeAll.error.message}</span> : null}
      {resumeAll.isSuccess && resumed === 0 && skipped.length === 0 ? <span className="broadcasts__resume-note">Nenhum disparo para retomar</span> : null}
      {skipped.length > 0 ? <span className="run-actions__error" role="alert">{skipped.length} não retomado(s): {skipped[0].error}</span> : null}
    </div>
  )
}

export function BroadcastRunsSection({ sessions, page, openReportId, onPageChange, onOpenReport }: BroadcastRunsSectionProps) {
  const runs = useBroadcastRuns(page)
  const items = runs.data?.items ?? []
  const columns = buildRunColumns(sessions, openReportId, onOpenReport)

  return (
    <section className="broadcasts__section" aria-labelledby="runs-title">
      <header className="broadcasts__section-header">
        <h2 id="runs-title" className="broadcasts__section-title">Histórico</h2>
        <ResumeAllButton />
      </header>
      {runs.isError ? <EmptyState title="Não foi possível carregar o histórico">{runs.error.message}</EmptyState> : null}
      {runs.isSuccess && items.length === 0 ? <EmptyState title="Nenhum disparo ainda" /> : null}
      {items.length > 0 ? <DataTable caption="Histórico de disparos" columns={columns} rows={items} getRowKey={getRunKey} isBusy={runs.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={runs.data?.total ?? 0} label="Paginação do histórico" onPageChange={onPageChange} />
    </section>
  )
}
