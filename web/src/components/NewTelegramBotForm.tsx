import { useState, type FormEvent } from 'react'
import { useCreateTelegramBot } from '../hooks/useTelegramInstances'
import type { InstanceCreateFormProps } from '../types/components'

export function NewTelegramBotForm({ onCreated }: InstanceCreateFormProps) {
  const [botToken, setBotToken] = useState('')
  const create = useCreateTelegramBot()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = botToken.trim()
    if (!token) return
    create.mutate(token, {
      onSuccess: (bot) => {
        setBotToken('')
        onCreated(bot.sessionId)
      },
    })
  }

  return (
    <form className="new-session__form" onSubmit={handleSubmit}>
      <div className="new-session__row">
        <input
          className="new-session__input"
          type="password"
          value={botToken}
          onChange={(event) => setBotToken(event.target.value)}
          placeholder="token do @BotFather"
          autoComplete="off"
          spellCheck={false}
          aria-label="Token do bot do Telegram"
          aria-describedby="new-bot-hint"
        />
        <button type="submit" className="new-session__submit" disabled={botToken.trim().length === 0 || create.isPending}>
          {create.isPending ? '…' : 'Criar'}
        </button>
      </div>
      <p id="new-bot-hint" className="new-session__hint" role={create.isError ? 'alert' : undefined}>
        {create.isError ? create.error.message : 'No @BotFather: /newbot e cole o token aqui'}
      </p>
    </form>
  )
}
