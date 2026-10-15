import { useState } from 'react'
import { useContacts } from '../hooks/useContacts'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useGroups } from '../hooks/useGroups'
import { toggleTarget, targetKey } from '../lib/downAlertTargets'
import { formatPhone } from '../lib/format'
import { CONTACT_PICKER_PER_PAGE, GROUP_PICKER_PER_PAGE } from '../lib/panelApi'
import type { Contact, DownAlertTarget, WhatsAppGroup } from '../types/api'
import type { DownAlertTargetsProps, TargetOption } from '../types/components'
import { TargetOptionList } from './TargetOptionList'

const SEARCH_DEBOUNCE_MS = 250

const contactOption = (contact: Contact): TargetOption => ({
  target: { kind: 'contact', phone: contact.phone, name: contact.name },
  detail: formatPhone(contact.phone),
})

const groupOption = (group: WhatsAppGroup): TargetOption => ({
  target: { kind: 'group', chatId: group.chatId, name: group.name || group.chatId },
  detail: `${group.memberSessionIds.length} instância(s)`,
})

const describeTarget = (target: DownAlertTarget): string => (target.kind === 'group' ? `Grupo · ${target.name}` : `${target.name} · ${formatPhone(target.phone)}`)

// Busca + página por lista; trocar a busca volta para a página 1
function usePagedSearch() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const onSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  return { search, page, setPage, onSearchChange, query: { page, search: debounced } }
}

export function DownAlertTargets({ targets, onChange }: DownAlertTargetsProps) {
  const contactSearch = usePagedSearch()
  const groupSearch = usePagedSearch()
  const contacts = useContacts(contactSearch.query, CONTACT_PICKER_PER_PAGE)
  const groups = useGroups(groupSearch.query, GROUP_PICKER_PER_PAGE)
  const toggle = (target: DownAlertTarget) => onChange(toggleTarget(targets, target))

  return (
    <div className="down-alert__targets">
      <p className="field__label">Recebem o aviso ({targets.length})</p>
      {targets.length === 0 ? <p className="settings__hint">Nenhum destino escolhido.</p> : (
        <ul className="down-alert__chosen">
          {targets.map((target) => (
            <li key={targetKey(target)}>
              <span>{describeTarget(target)}</span>
              <button type="button" className="credentials__dismiss" onClick={() => toggle(target)} aria-label={`Remover ${target.name}`}>Remover</button>
            </li>
          ))}
        </ul>
      )}
      <div className="settings__pair">
        <TargetOptionList
          label="Contatos da agenda"
          search={contactSearch.search}
          onSearchChange={contactSearch.onSearchChange}
          options={(contacts.data?.items ?? []).map(contactOption)}
          selected={targets}
          onToggle={toggle}
          page={contactSearch.page}
          perPage={CONTACT_PICKER_PER_PAGE}
          total={contacts.data?.total ?? 0}
          onPageChange={contactSearch.setPage}
          isFetching={contacts.isFetching}
          emptyText={contactSearch.search ? 'Nenhum contato encontrado.' : 'Cadastre contatos na Agenda primeiro.'}
        />
        <TargetOptionList
          label="Grupos"
          search={groupSearch.search}
          onSearchChange={groupSearch.onSearchChange}
          options={(groups.data?.items ?? []).map(groupOption)}
          selected={targets}
          onToggle={toggle}
          page={groupSearch.page}
          perPage={GROUP_PICKER_PER_PAGE}
          total={groups.data?.total ?? 0}
          onPageChange={groupSearch.setPage}
          isFetching={groups.isFetching}
          emptyText={groupSearch.search ? 'Nenhum grupo encontrado.' : 'Nenhum grupo nas instâncias conectadas.'}
        />
      </div>
    </div>
  )
}
