import { presentStatus } from '../lib/sessionStatus'
import type { StatusLampProps } from '../types/components'

export function StatusLamp({ status, showLabel = false }: StatusLampProps) {
  const { label, tone } = presentStatus(status)
  return (
    <span className="status-lamp" data-tone={tone} title={label}>
      <span className="status-lamp__bulb" aria-hidden="true" />
      {showLabel ? <span className="status-lamp__label">{label}</span> : <span className="visually-hidden">{label}</span>}
    </span>
  )
}
