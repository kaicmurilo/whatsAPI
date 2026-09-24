import type { ReportSummaryCardsProps } from '../types/components'

const percentOf = (value: number, total: number): string => (total > 0 ? `${Math.round((value / total) * 100)}%` : '—')

// Funil do disparo: cada métrica em relação ao total da lista
export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const metrics = [
    { key: 'sent', label: 'Enviados', value: summary.sent, tone: 'ink' },
    { key: 'delivered', label: 'Entregues', value: summary.delivered, tone: 'live' },
    { key: 'read', label: 'Lidos', value: summary.read, tone: 'live' },
    { key: 'played', label: 'Reproduzidos', value: summary.played, tone: 'live' },
    { key: 'failed', label: 'Falhas', value: summary.failed, tone: 'alert' },
  ]

  return (
    <dl className="report-cards">
      {metrics.map((metric) => (
        <div key={metric.key} className="report-card" data-tone={metric.tone}>
          <dt className="report-card__label">{metric.label}</dt>
          <dd className="report-card__value">{metric.value}</dd>
          <dd className="report-card__percent">{percentOf(metric.value, summary.total)} de {summary.total}</dd>
        </div>
      ))}
    </dl>
  )
}
