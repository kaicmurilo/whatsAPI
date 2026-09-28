import type { WhatsAppSession } from '../types/api'
import type { InstancePickerProps } from '../types/components'

const labelOf = (session: WhatsAppSession): string => {
  const name = session.pushName ?? session.sessionId
  const phone = session.phone ? ` +${session.phone}` : ''
  const down = session.status === 'connected' ? '' : ' (desconectada)'
  return `${name}${phone}${down}`
}

// Uma, algumas ou todas. "Todas" marca só as que podem ser escolhidas neste momento.
export function InstancePicker({ sessions, selectedIds, onChange, allowDisconnected, isDisabled = false }: InstancePickerProps) {
  const canSelect = (session: WhatsAppSession): boolean => allowDisconnected || session.status === 'connected'
  const selectableIds = sessions.filter(canSelect).map((session) => session.sessionId)
  const selectedSelectable = selectableIds.filter((sessionId) => selectedIds.includes(sessionId))
  const allSelected = selectableIds.length > 0 && selectedSelectable.length === selectableIds.length
  const someSelected = selectedSelectable.length > 0 && !allSelected

  const toggleAll = () => onChange(allSelected ? [] : selectableIds)

  const toggleOne = (sessionId: string) => {
    onChange(
      selectedIds.includes(sessionId)
        ? selectedIds.filter((current) => current !== sessionId)
        : [...selectedIds, sessionId],
    )
  }

  return (
    <fieldset className="instance-picker" disabled={isDisabled}>
      <legend className="field__label">Instâncias que enviam</legend>
      <label className="instance-picker__option">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(element) => {
            if (element) element.indeterminate = someSelected
          }}
          onChange={toggleAll}
          disabled={selectableIds.length === 0}
        />
        <span>Todas</span>
      </label>
      {sessions.map((session) => (
        <label key={session.sessionId} className="instance-picker__option">
          <input
            type="checkbox"
            checked={selectedIds.includes(session.sessionId)}
            disabled={!canSelect(session)}
            onChange={() => toggleOne(session.sessionId)}
          />
          <span>{labelOf(session)}</span>
        </label>
      ))}
    </fieldset>
  )
}
