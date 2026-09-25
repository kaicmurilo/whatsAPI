import { useAuth } from '../auth/useAuth'
import { BroadcastsPane } from '../components/BroadcastsPane'
import { ChatListPane } from '../components/ChatListPane'
import { ContactsPane } from '../components/ContactsPane'
import { ConversationPane } from '../components/ConversationPane'
import { EmptyState } from '../components/EmptyState'
import { FilesPane } from '../components/FilesPane'
import { QrCard } from '../components/QrCard'
import { SessionRail } from '../components/SessionRail'
import { TemplatesPane } from '../components/TemplatesPane'
import { usePanelPage } from '../hooks/usePanelPage'

export function PanelPage() {
  const { logout } = useAuth()
  const { sessions, selectedSession, selection, ...actions } = usePanelPage()
  const { view, tables } = selection
  const isChatsView = view === 'chats'
  const showChats = isChatsView && selectedSession !== null && !selectedSession.showQr
  const sessionList = sessions.data ?? []

  return (
    <div className="panel" data-has-chat={showChats && selection.chatId ? 'true' : 'false'}>
      <SessionRail
        sessions={sessionList}
        isLoading={sessions.isPending}
        selectedSessionId={selection.sessionId}
        activeView={view}
        onSelect={actions.selectSession}
        onOpenView={actions.setView}
        onLogout={logout}
      />

      <main className="panel__main">
        {view === 'contacts' ? (
          <ContactsPane
            session={selectedSession?.session ?? null}
            page={tables.contacts.page}
            search={tables.contacts.search}
            onPageChange={(page) => actions.setTablePage('contacts', page)}
            onSearchChange={(search) => actions.setTableSearch('contacts', search)}
            onOpenChat={actions.openChat}
          />
        ) : null}

        {view === 'templates' ? (
          <TemplatesPane
            page={tables.templates.page}
            search={tables.templates.search}
            onPageChange={(page) => actions.setTablePage('templates', page)}
            onSearchChange={(search) => actions.setTableSearch('templates', search)}
          />
        ) : null}

        {view === 'broadcasts' ? (
          <BroadcastsPane
            sessions={sessionList}
            defaultSessionId={selectedSession?.session.sessionId ?? null}
            lists={tables.lists}
            runs={tables.runs}
            onTablePage={actions.setTablePage}
            onTableSearch={actions.setTableSearch}
            report={selection.report}
            onOpenReport={actions.openReport}
            onReportPage={actions.setReportPage}
            onReportSituation={actions.setReportSituation}
          />
        ) : null}

        {view === 'files' ? (
          <FilesPane
            page={tables.files.page}
            search={tables.files.search}
            onPageChange={(page) => actions.setTablePage('files', page)}
            onSearchChange={(search) => actions.setTableSearch('files', search)}
          />
        ) : null}

        {isChatsView && !selectedSession ? (
          <EmptyState title={selection.sessionId ? 'Instância não encontrada' : 'Escolha uma instância'}>
            Selecione um número na coluna ao lado ou crie uma nova instância.
          </EmptyState>
        ) : null}

        {isChatsView && selectedSession?.showQr ? <QrCard session={selectedSession.session} /> : null}

        {showChats && selectedSession ? (
          <>
            <ChatListPane
              key={selectedSession.session.sessionId}
              session={selectedSession.session}
              selectedChatId={selection.chatId}
              page={selection.page}
              search={selection.search}
              onSelectChat={actions.selectChat}
              onPageChange={actions.setPage}
              onSearchChange={actions.setSearch}
            />
            {selection.chatId ? (
              <ConversationPane session={selectedSession.session} chatId={selection.chatId} onClose={() => actions.selectChat(null)} />
            ) : (
              <div className="panel__placeholder">
                <EmptyState title="Nenhuma conversa aberta">Escolha uma conversa para ler e responder.</EmptyState>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
