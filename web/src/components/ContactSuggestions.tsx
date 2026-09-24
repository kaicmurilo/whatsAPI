import { formatPhone } from '../lib/format'
import type { ContactSuggestionsProps } from '../types/components'

export function ContactSuggestions({ contacts, isDisabled, onPick }: ContactSuggestionsProps) {
  if (contacts.length === 0) return null

  return (
    <ul className="contact-suggestions" aria-label="Contatos da agenda">
      {contacts.map((contact) => (
        <li key={contact.id}>
          <button type="button" className="contact-suggestions__item" disabled={isDisabled} onClick={() => onPick(contact)}>
            <span className="contact-suggestions__name">{contact.name}</span>
            <span className="contact-suggestions__phone">{formatPhone(contact.phone)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
