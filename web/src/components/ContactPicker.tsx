import { useState } from 'react'
import { useContacts } from '../hooks/useContacts'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatPhone } from '../lib/format'
import { CONTACT_PICKER_PER_PAGE } from '../lib/panelApi'
import type { BroadcastListMember } from '../types/api'
import type { ContactPickerProps } from '../types/components'
import { Pagination } from './Pagination'

const SEARCH_DEBOUNCE_MS = 250

const toMember = ({ id, name, phone }: BroadcastListMember): BroadcastListMember => ({ id, name, phone })

// Seleção vive no pai (Map id → contato) para sobreviver à troca de página e à busca
export function ContactPicker({ selected, onChange }: ContactPickerProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const contacts = useContacts({ page, search: debouncedSearch }, CONTACT_PICKER_PER_PAGE)
  const pageContacts = contacts.data?.items ?? []
  const isWholePageSelected = pageContacts.length > 0 && pageContacts.every((contact) => selected.has(contact.id))

  const toggle = (contact: BroadcastListMember) => {
    const next = new Map(selected)
    if (next.has(contact.id)) next.delete(contact.id)
    else next.set(contact.id, toMember(contact))
    onChange(next)
  }

  const togglePage = () => {
    const next = new Map(selected)
    for (const contact of pageContacts) {
      if (isWholePageSelected) next.delete(contact.id)
      else next.set(contact.id, toMember(contact))
    }
    onChange(next)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <fieldset className="contact-picker">
      <legend className="field__label">Contatos ({selected.size} selecionados)</legend>
      <div className="contact-picker__toolbar">
        <input
          className="search-input"
          type="search"
          value={search}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder="Buscar na agenda"
          aria-label="Buscar contatos para a lista"
        />
        <button type="button" className="contact-picker__page-toggle" onClick={togglePage} disabled={pageContacts.length === 0}>
          {isWholePageSelected ? 'Desmarcar página' : 'Marcar página'}
        </button>
      </div>
      <ul className="contact-picker__list" aria-busy={contacts.isFetching}>
        {pageContacts.map((contact) => (
          <li key={contact.id}>
            <label className="contact-picker__item">
              <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggle(contact)} />
              <span className="contact-picker__name">{contact.name}</span>
              <span className="contact-picker__phone">{formatPhone(contact.phone)}</span>
            </label>
          </li>
        ))}
      </ul>
      {contacts.isSuccess && pageContacts.length === 0 ? (
        <p className="contact-picker__empty">{debouncedSearch ? 'Nenhum contato encontrado.' : 'Cadastre contatos na Agenda primeiro.'}</p>
      ) : null}
      <Pagination page={page} perPage={CONTACT_PICKER_PER_PAGE} total={contacts.data?.total ?? 0} label="Paginação da agenda" onPageChange={setPage} />
    </fieldset>
  )
}
