import type { SessionRailItemProps } from '../types/components'
import { StatusLamp } from './StatusLamp'

export function SessionRailItem({ session, isSelected, onSelect }: SessionRailItemProps) {
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
          <span className="rail-item__name">{session.pushName ?? session.sessionId}</span>
          <span className="rail-item__meta">{session.phone ? `+${session.phone}` : session.sessionId}</span>
        </span>
      </button>
    </li>
  )
}
