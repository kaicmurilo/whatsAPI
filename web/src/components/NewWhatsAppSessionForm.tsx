import { useState, type FormEvent } from 'react'
import { useStartSession } from '../hooks/usePanelData'
import { SESSION_ID_PATTERN } from '../lib/sessionStatus'
import type { InstanceCreateFormProps } from '../types/components'

export function NewWhatsAppSessionForm({ onCreated }: InstanceCreateFormProps) {
  const [sessionId, setSessionId] = useState('')
  const startSession = useStartSession()
  const isValid = SESSION_ID_PATTERN.test(sessionId)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValid) return
    startSession.mutate(sessionId, {
      onSuccess: () => {
        onCreated(sessionId)
        setSessionId('')
      },
    })
  }

  return (
    <form className="new-session__form" onSubmit={handleSubmit}>
      <div className="new-session__row">
        <input
          className="new-session__input"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value.trim())}
          placeholder="ex: loja-centro-01"
          autoComplete="off"
          spellCheck={false}
          aria-label="Nome da instância do WhatsApp"
          aria-describedby="new-session-hint"
        />
        <button type="submit" className="new-session__submit" disabled={!isValid || startSession.isPending}>
          {startSession.isPending ? '…' : 'Criar'}
        </button>
      </div>
      <p id="new-session-hint" className="new-session__hint" role={startSession.isError ? 'alert' : undefined}>
        {startSession.isError ? startSession.error.message : '10–100 caracteres: letras, números, - e _'}
      </p>
    </form>
  )
}
