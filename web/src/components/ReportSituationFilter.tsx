import type { ReportSituation } from '../types/api'
import type { ReportSituationFilterProps } from '../types/components'

const OPTIONS: { value: ReportSituation; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'read', label: 'Lidos' },
  { value: 'sent', label: 'Enviados' },
  { value: 'failed', label: 'Falhas' },
  { value: 'pending', label: 'Pendentes' },
]

export function ReportSituationFilter({ value, onChange }: ReportSituationFilterProps) {
  return (
    <div className="report-filter" role="radiogroup" aria-label="Filtrar destinatários">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className="report-filter__option"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
