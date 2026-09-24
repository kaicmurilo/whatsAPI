import { useState, type FormEvent } from 'react'
import { useStartSession } from '../hooks/usePanelData'
import { SESSION_ID_PATTERN } from '../lib/sessionStatus'
import type { NewSessionFormProps } from '../types/components'

export function NewSessionForm({ onCreated }: NewSessionFormProps) {
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
    <form className="new-session" onSubmit={handleSubmit}>
      <label className="new-session__label" htmlFor="new-session-id">Nova instância</label>
      <div className="new-session__row">
        <input
          id="new-session-id"
          className="new-session__input"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value.trim())}
          placeholder="ex: loja-centro-01"
          autoComplete="off"
          spellCheck={false}
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
