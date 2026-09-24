import { formatChatId, formatMessageTime, mediaLabel } from '../lib/format'
import type { MessageBubbleProps } from '../types/components'

export function MessageBubble({ message, showAuthor }: MessageBubbleProps) {
  const media = mediaLabel(message.type) ?? (message.hasMedia ? 'Mídia' : null)
  const author = message.senderName ?? (message.author ? formatChatId(message.author) : null)

  return (
    <li className="bubble" data-direction={message.fromMe ? 'out' : 'in'}>
      {showAuthor && !message.fromMe && author ? <span className="bubble__author">{author}</span> : null}
      {media ? (
        <span className="bubble__media">
          {media}
          {message.mediaFilename ? <span className="bubble__file"> · {message.mediaFilename}</span> : null}
        </span>
      ) : null}
      {message.body ? <p className="bubble__body">{message.body}</p> : null}
      <time className="bubble__time" dateTime={message.sentAt}>{formatMessageTime(message.sentAt)}</time>
    </li>
  )
}
