import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSendMessage } from '../hooks/useMessaging'
import type { PanelFile } from '../types/api'
import type { MessageComposerProps } from '../types/components'
import { FilePicker } from './FilePicker'

const MAX_TEXT_LENGTH = 4096

function describeHint(isConnected: boolean, errorMessage: string | null, hasFile: boolean): string | null {
  if (!isConnected) return 'Instância desconectada — reconecte para enviar.'
  if (errorMessage) return errorMessage
  return hasFile ? 'O texto vai como legenda do arquivo.' : null
}

export function MessageComposer({ sessionId, chatId, isConnected }: MessageComposerProps) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<PanelFile | null>(null)
  const sendMessage = useSendMessage()
  const canSend = isConnected && (text.trim().length > 0 || file !== null) && !sendMessage.isPending

  const submit = () => {
    if (!canSend) return
    sendMessage.mutate(
      { sessionId, chatId, message: { text: text.trim(), fileId: file?.id ?? null } },
      {
        onSuccess: () => {
          setText('')
          setFile(null)
        },
      },
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  // Enter envia; Shift+Enter quebra linha (padrão do WhatsApp Web)
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const hint = describeHint(isConnected, sendMessage.isError ? sendMessage.error.message : null, file !== null)

  return (
    <form className="composer" onSubmit={handleSubmit}>
      {hint ? <p className="composer__hint" role={sendMessage.isError ? 'alert' : undefined}>{hint}</p> : null}
      <FilePicker selectedFile={file} onChange={setFile} isDisabled={!isConnected || sendMessage.isPending} />
      <div className="composer__row">
        <textarea
          className="composer__input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? (file ? 'Legenda (opcional)' : 'Escreva uma mensagem') : 'Envio indisponível'}
          aria-label="Mensagem"
          rows={1}
          maxLength={MAX_TEXT_LENGTH}
          disabled={!isConnected}
        />
        <button type="submit" className="composer__send" disabled={!canSend}>
          {sendMessage.isPending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </form>
  )
}
