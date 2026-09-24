import type { BroadcastsPaneProps } from '../types/components'
import { BroadcastListsSection } from './BroadcastListsSection'
import { BroadcastReport } from './BroadcastReport'
import { BroadcastRunsSection } from './BroadcastRunsSection'
import { BroadcastSendForm } from './BroadcastSendForm'

export function BroadcastsPane({
  sessions, defaultSessionId, lists, runs, onTablePage, onTableSearch, report, onOpenReport, onReportPage, onReportSituation,
}: BroadcastsPaneProps) {
  return (
    <section className="library broadcasts" aria-labelledby="broadcasts-title">
      <header className="library__header">
        <p className="library__eyebrow">Transmissão</p>
        <h1 id="broadcasts-title" className="library__title">Listas de transmissão</h1>
        <p className="library__note">
          Cada contato recebe a mensagem individualmente, como uma conversa normal — não precisa ter o seu número salvo.
        </p>
      </header>

      <div className="broadcasts__layout">
        <BroadcastSendForm sessions={sessions} defaultSessionId={defaultSessionId} />
        <BroadcastListsSection
          page={lists.page}
          search={lists.search}
          onPageChange={(page) => onTablePage('lists', page)}
          onSearchChange={(search) => onTableSearch('lists', search)}
        />
      </div>

      {report.runId ? (
        <BroadcastReport
          key={report.runId}
          runId={report.runId}
          page={report.page}
          situation={report.situation}
          onClose={() => onOpenReport(null)}
          onPageChange={onReportPage}
          onSituationChange={onReportSituation}
        />
      ) : null}

      <BroadcastRunsSection
        page={runs.page}
        openReportId={report.runId}
        onPageChange={(page) => onTablePage('runs', page)}
        onOpenReport={onOpenReport}
      />
    </section>
  )
}
