import { formatCount } from '../lib/metricFormat'
import type { VolumeCardProps } from '../types/components'

export function VolumeCard({ label, value, detail }: VolumeCardProps) {
  return (
    <div className="report-card">
      <dt className="report-card__label">{label}</dt>
      <dd className="report-card__value">{formatCount(value)}</dd>
      <dd className="report-card__percent">{detail}</dd>
    </div>
  )
}
