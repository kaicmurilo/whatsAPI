import { formatPhone } from '../lib/format'
import type { SessionRailItemProps } from '../types/components'
import { StatusLamp } from './StatusLamp'

export function SessionRailItem({ session, isSelected, onSelect }: SessionRailItemProps) {
  const phone = session.phone ? formatPhone(session.phone) : null

  return (
    <li>
      <button
        type="button"
        className="rail-item"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(session.sessionId)}
      >
        <StatusLamp status={session.status} />
        <span className="rail-item__text">
          <span className="rail-item__name">{session.sessionId}</span>
          {session.pushName ? <span className="rail-item__meta">{session.pushName}</span> : null}
          {phone ? <span className="rail-item__meta">{phone}</span> : null}
        </span>
      </button>
    </li>
  )
}
