import { useChats, useStartSession } from '../hooks/usePanelData'
import { CHATS_PER_PAGE } from '../lib/panelApi'
import type { ChatListPaneProps } from '../types/components'
import { ChatRow } from './ChatRow'
import { EmptyState } from './EmptyState'
import { NewChatForm } from './NewChatForm'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'
import { StatusLamp } from './StatusLamp'

export function ChatListPane({ session, selectedChatId, page, search, onSelectChat, onPageChange, onSearchChange }: ChatListPaneProps) {
  const chats = useChats(session.sessionId, { page, search })
  const startSession = useStartSession()

  const items = chats.data?.items ?? []
  const canRestart = session.status === 'stopped' || session.status === 'disconnected'

  return (
    <section className="chats" aria-labelledby="chats-title">
      <header className="chats__header">
        <div className="chats__heading">
          <h1 id="chats-title" className="chats__title">{session.pushName ?? session.sessionId}</h1>
          <StatusLamp status={session.status} showLabel />
        </div>
        {canRestart ? (
          <button type="button" className="chats__restart" disabled={startSession.isPending} onClick={() => startSession.mutate(session.sessionId)}>
            Reconectar
          </button>
        ) : null}
        <NewChatForm sessionId={session.sessionId} isConnected={session.status === 'connected'} onOpenChat={onSelectChat} />
        <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar por nome ou número" label="Buscar conversas" />
      </header>

      {chats.isError ? <EmptyState title="Não foi possível carregar as conversas">{chats.error.message}</EmptyState> : null}
      {chats.isSuccess && items.length === 0 ? (
        <EmptyState title={search ? 'Nada encontrado' : 'Sem mensagens salvas'}>
          {search ? null : 'Ao conectar, as conversas recentes são importadas. Use "Nova conversa" para falar com outro número.'}
        </EmptyState>
      ) : null}

      <ul className="chats__list" aria-busy={chats.isFetching}>
        {items.map((chat) => (
          <ChatRow key={chat.chatId} chat={chat} isSelected={chat.chatId === selectedChatId} onSelect={onSelectChat} />
        ))}
      </ul>

      <Pagination page={page} perPage={CHATS_PER_PAGE} total={chats.data?.total ?? 0} label="Paginação das conversas" onPageChange={onPageChange} />
    </section>
  )
}
