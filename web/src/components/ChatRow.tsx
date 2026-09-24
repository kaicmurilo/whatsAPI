import { formatChatTitle, formatListTime, isGroupChat, previewText } from '../lib/format'
import type { ChatRowProps } from '../types/components'

export function ChatRow({ chat, isSelected, onSelect }: ChatRowProps) {
  const preview = previewText(chat.lastType, chat.lastBody)
  return (
    <li>
      <button
        type="button"
        className="chat-row"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(chat.chatId)}
      >
        <span className="chat-row__title">
          {formatChatTitle(chat.chatId, chat.contactName, chat.chatName)}
          {isGroupChat(chat.chatId) ? <span className="chat-row__tag">grupo</span> : null}
        </span>
        <time className="chat-row__time" dateTime={chat.lastSentAt}>{formatListTime(chat.lastSentAt)}</time>
        <span className="chat-row__preview">
          {chat.lastFromMe ? <span className="chat-row__you">Você: </span> : null}
          {preview || '—'}
        </span>
      </button>
    </li>
  )
}
