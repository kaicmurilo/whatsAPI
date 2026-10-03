import { useState } from 'react'
import type { NewSessionFormProps } from '../types/components'
import { NewTelegramAccountForm } from './NewTelegramAccountForm'
import { NewTelegramBotForm } from './NewTelegramBotForm'
import { NewWhatsAppSessionForm } from './NewWhatsAppSessionForm'

type InstanceKind = 'whatsapp' | 'telegram-bot' | 'telegram-account'

const KINDS: { kind: InstanceKind; label: string }[] = [
  { kind: 'whatsapp', label: 'WhatsApp' },
  { kind: 'telegram-bot', label: 'TG bot' },
  { kind: 'telegram-account', label: 'TG conta' },
]

// Instância nova: número do WhatsApp (QR), bot do Telegram (token) ou conta do Telegram (login por código)
export function NewSessionForm({ onCreated, onTelegramCreated }: NewSessionFormProps) {
  const [kind, setKind] = useState<InstanceKind>('whatsapp')
  return (
    <div className="new-session">
      <span className="new-session__label">Nova instância</span>
      <div className="new-session__kinds" role="radiogroup" aria-label="Tipo da instância">
        {KINDS.map((option) => (
          <button
            key={option.kind}
            type="button"
            role="radio"
            aria-checked={kind === option.kind}
            className="new-session__kind"
            onClick={() => setKind(option.kind)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {kind === 'whatsapp' ? <NewWhatsAppSessionForm onCreated={onCreated} /> : null}
      {kind === 'telegram-bot' ? <NewTelegramBotForm onCreated={onTelegramCreated} /> : null}
      {kind === 'telegram-account' ? <NewTelegramAccountForm onCreated={onTelegramCreated} /> : null}
    </div>
  )
}
