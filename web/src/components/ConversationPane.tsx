import { useMessages } from '../hooks/usePanelData'
import { formatChatId, formatChatTitle, isGroupChat } from '../lib/format'
import type { MessagePage, StoredMessage } from '../types/api'
import type { ConversationPaneProps } from '../types/components'
import { EmptyState } from './EmptyState'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'

// Páginas chegam da mais nova para a mais antiga; a lista usa column-reverse, então a ordem já serve
const flattenNewestFirst = (pages: MessagePage[] | undefined): StoredMessage[] =>
  pages?.flatMap((page) => page.items) ?? []

export function ConversationPane({ session, chatId, onClose }: ConversationPaneProps) {
  const messages = useMessages(session.sessionId, chatId)
  const items = flattenNewestFirst(messages.data?.pages)
  const contactName = messages.data?.pages[0]?.contactName ?? null
  const whatsappName = items.find((message) => message.chatName)?.chatName ?? null
  const isGroup = isGroupChat(chatId)
  const isEmpty = messages.isSuccess && items.length === 0

  return (
    <section className="conversation" aria-labelledby="conversation-title">
      <header className="conversation__header">
        <button type="button" className="conversation__back" onClick={onClose} aria-label="Voltar para conversas">‹</button>
        <div>
          <h2 id="conversation-title" className="conversation__title">{formatChatTitle(chatId, contactName, whatsappName)}</h2>
          <p className="conversation__id">{formatChatId(chatId)}</p>
        </div>
      </header>

      {messages.isError ? <EmptyState title="Não foi possível carregar as mensagens">{messages.error.message}</EmptyState> : null}
      {isEmpty ? <EmptyState title="Nenhuma mensagem ainda">Envie a primeira mensagem abaixo.</EmptyState> : null}

      <ol className="conversation__stream" aria-live="polite" aria-busy={messages.isFetching}>
        {items.map((message) => (
          <MessageBubble key={message.id} message={message} showAuthor={isGroup} />
        ))}
        {messages.hasNextPage ? (
          <li className="conversation__older">
            <button type="button" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage}>
              {messages.isFetchingNextPage ? 'Carregando…' : 'Carregar anteriores'}
            </button>
          </li>
        ) : null}
      </ol>

      <MessageComposer sessionId={session.sessionId} chatId={chatId} isConnected={session.status === 'connected'} />
    </section>
  )
}
