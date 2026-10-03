import type { PanelView } from '../hooks/usePanelSearchParams'
import type { SessionRailProps } from '../types/components'
import { NewSessionForm } from './NewSessionForm'
import { SessionRailItem } from './SessionRailItem'
import { TelegramRailItem } from './TelegramRailItem'

const RAIL_VIEWS: { view: PanelView; label: string }[] = [
  { view: 'dashboard', label: 'Painel' },
  { view: 'contacts', label: 'Contatos' },
  { view: 'templates', label: 'Mensagens' },
  { view: 'broadcasts', label: 'Transmissão' },
  { view: 'queue', label: 'Fila' },
  { view: 'files', label: 'Arquivos' },
  { view: 'settings', label: 'Configurações' },
]

export function SessionRail({
  sessions, telegramInstances, isLoading, selectedSessionId, activeView, onSelect, onSelectTelegram, onOpenView, onLogout,
}: SessionRailProps) {
  const instanceCount = sessions.length + telegramInstances.length
  return (
    <nav className="rail" aria-label="Instâncias">
      <header className="rail__header">
        <span className="rail__brand">Central</span>
        <span className="rail__count">{instanceCount.toString().padStart(2, '0')} instâncias</span>
      </header>

      <div className="rail__views">
        {RAIL_VIEWS.map(({ view, label }) => (
          <button key={view} type="button" className="rail__view" aria-current={activeView === view ? 'page' : undefined} onClick={() => onOpenView(view)}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="rail__note">Carregando…</p> : null}
      {!isLoading && instanceCount === 0 ? <p className="rail__note">Nenhuma instância ainda.</p> : null}

      <ul className="rail__list">
        {sessions.map((session) => (
          <SessionRailItem
            key={session.sessionId}
            session={session}
            isSelected={activeView === 'chats' && session.sessionId === selectedSessionId}
            onSelect={onSelect}
          />
        ))}
        {telegramInstances.map((instance) => (
          <TelegramRailItem
            key={instance.sessionId}
            instance={instance}
            isSelected={activeView === 'telegram' && instance.sessionId === selectedSessionId}
            onSelect={onSelectTelegram}
          />
        ))}
      </ul>

      <NewSessionForm onCreated={onSelect} onTelegramCreated={onSelectTelegram} />

      <button type="button" className="rail__logout" onClick={onLogout}>Sair</button>
    </nav>
  )
}
