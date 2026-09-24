import type { PanelView } from '../hooks/usePanelSearchParams'
import type { SessionRailProps } from '../types/components'
import { NewSessionForm } from './NewSessionForm'
import { SessionRailItem } from './SessionRailItem'

const RAIL_VIEWS: { view: PanelView; label: string }[] = [
  { view: 'contacts', label: 'Contatos' },
  { view: 'broadcasts', label: 'Transmissão' },
  { view: 'files', label: 'Arquivos' },
]

export function SessionRail({ sessions, isLoading, selectedSessionId, activeView, onSelect, onOpenView, onLogout }: SessionRailProps) {
  return (
    <nav className="rail" aria-label="Instâncias">
      <header className="rail__header">
        <span className="rail__brand">Central</span>
        <span className="rail__count">{sessions.length.toString().padStart(2, '0')} instâncias</span>
      </header>

      <div className="rail__views">
        {RAIL_VIEWS.map(({ view, label }) => (
          <button key={view} type="button" className="rail__view" aria-current={activeView === view ? 'page' : undefined} onClick={() => onOpenView(view)}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="rail__note">Carregando…</p> : null}
      {!isLoading && sessions.length === 0 ? <p className="rail__note">Nenhuma instância ainda.</p> : null}

      <ul className="rail__list">
        {sessions.map((session) => (
          <SessionRailItem
            key={session.sessionId}
            session={session}
            isSelected={activeView === 'chats' && session.sessionId === selectedSessionId}
            onSelect={onSelect}
          />
        ))}
      </ul>

      <NewSessionForm onCreated={onSelect} />

      <button type="button" className="rail__logout" onClick={onLogout}>Sair</button>
    </nav>
  )
}
