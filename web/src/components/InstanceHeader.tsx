import { useStartSession } from '../hooks/usePanelData'
import { whatsappIdentity } from '../lib/sessionLabel'
import type { InstanceHeaderProps } from '../types/components'
import { RemoveInstanceButton } from './RemoveInstanceButton'
import { StatusLamp } from './StatusLamp'

export function InstanceHeader({ session, onRemoved, children }: InstanceHeaderProps) {
  const startSession = useStartSession()
  const canRestart = session.status === 'stopped' || session.status === 'disconnected'
  const identity = whatsappIdentity(session)

  return (
    <header className="chats__header">
      <div className="chats__heading">
        <h1 id="chats-title" className="chats__title">{session.sessionId}</h1>
        {identity ? <p className="chats__identity">{identity}</p> : null}
        <StatusLamp status={session.status} showLabel />
      </div>
      {canRestart ? (
        <button type="button" className="chats__restart" disabled={startSession.isPending} onClick={() => startSession.mutate(session.sessionId)}>
          Reconectar
        </button>
      ) : null}
      <RemoveInstanceButton sessionId={session.sessionId} onRemoved={onRemoved} />
      {children}
    </header>
  )
}
