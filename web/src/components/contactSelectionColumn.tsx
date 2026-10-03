import { pageSelectionState } from '../lib/selection'
import type { Contact } from '../types/api'
import type { DataTableColumn } from '../types/components'
import { IndeterminateCheckbox } from './IndeterminateCheckbox'

interface SelectionColumnInput {
  pageIds: string[]
  selected: ReadonlySet<string>
  onToggle: (contactId: string) => void
  onTogglePage: (isSelected: boolean) => void
}

// Checkbox por linha + "marcar a página" no cabeçalho; a seleção vale entre páginas
export function buildSelectionColumn({ pageIds, selected, onToggle, onTogglePage }: SelectionColumnInput): DataTableColumn<Contact> {
  const state = pageSelectionState(selected, pageIds)
  return {
    key: 'select',
    header: (
      <IndeterminateCheckbox
        label="Marcar os contatos desta página"
        checked={state === 'all'}
        indeterminate={state === 'some'}
        onChange={() => onTogglePage(state !== 'all')}
      />
    ),
    render: (contact) => (
      <input
        type="checkbox"
        aria-label={`Selecionar ${contact.name}`}
        checked={selected.has(contact.id)}
        onChange={() => onToggle(contact.id)}
      />
    ),
  }
}
