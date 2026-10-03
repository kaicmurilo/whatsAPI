import { formatPhone } from '../lib/format'
import type { TelegramInstance } from '../types/api'
import type { TelegramRailItemProps } from '../types/components'
import { StatusLamp } from './StatusLamp'

const describeInstance = (instance: TelegramInstance): string =>
  instance.kind === 'bot'
    ? `Telegram bot · ${instance.linkedContacts ?? 0} vinculado(s)`
    : `Telegram conta${instance.cooldownUntil ? ' · em pausa (limite)' : instance.phone ? ` · ${formatPhone(instance.phone)}` : ''}`

export function TelegramRailItem({ instance, isSelected, onSelect }: TelegramRailItemProps) {
  return (
    <li>
      <button
        type="button"
        className="rail-item"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(instance.sessionId)}
      >
        <StatusLamp status={instance.status} />
        <span className="rail-item__text">
          <span className="rail-item__name">{instance.label}</span>
          <span className="rail-item__meta">{describeInstance(instance)}</span>
        </span>
      </button>
    </li>
  )
}
