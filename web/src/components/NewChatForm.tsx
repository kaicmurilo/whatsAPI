import { useState, type FormEvent } from 'react'
import { useContacts } from '../hooks/useContacts'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useResolveChat } from '../hooks/useMessaging'
import type { NewChatFormProps } from '../types/components'
import { ContactSuggestions } from './ContactSuggestions'

const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15
const SUGGESTION_DEBOUNCE_MS = 250

const isPhoneLike = (value: string): boolean => {
  const digits = value.replace(/\D/g, '').length
  return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS
}

// Abre conversa por telefone digitado ou contato da agenda; o backend confirma que tem WhatsApp
export function NewChatForm({ sessionId, isConnected, onOpenChat }: NewChatFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), SUGGESTION_DEBOUNCE_MS)
  const suggestions = useContacts({ page: 1, search: debouncedQuery })
  const resolveChat = useResolveChat()

  const close = () => {
    setQuery('')
    setIsOpen(false)
    resolveChat.reset()
  }

  const openChatWith = (phone: string) => {
    resolveChat.mutate({ sessionId, phone }, {
      onSuccess: (chatId) => {
        onOpenChat(chatId)
        close()
      },
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPhoneLike(query)) openChatWith(query)
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="new-chat__toggle"
        disabled={!isConnected}
        title={isConnected ? undefined : 'A instância precisa estar conectada'}
        onClick={() => setIsOpen(true)}
      >
        + Nova conversa
      </button>
    )
  }

  return (
    <form className="new-chat" onSubmit={handleSubmit}>
      <div className="new-chat__row">
        <input
          className="new-chat__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome da agenda ou telefone com DDI"
          aria-label="Contato ou telefone"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className="new-chat__submit" disabled={!isPhoneLike(query) || resolveChat.isPending}>
          {resolveChat.isPending ? '…' : 'Abrir'}
        </button>
        <button type="button" className="new-chat__cancel" onClick={close} aria-label="Cancelar nova conversa">×</button>
      </div>
      <ContactSuggestions
        contacts={suggestions.data?.items ?? []}
        isDisabled={resolveChat.isPending}
        onPick={(contact) => openChatWith(contact.phone)}
      />
      {resolveChat.isError ? <p className="new-chat__error" role="alert">{resolveChat.error.message}</p> : null}
    </form>
  )
}
