import type { BroadcastChannel } from '../types/api'
import type { ChannelPickerProps } from '../types/components'

const CHANNEL_LABELS: Record<BroadcastChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

const CHANNELS = Object.keys(CHANNEL_LABELS) as BroadcastChannel[]

// Por onde o disparo sai; a mesma lista serve aos dois canais
export function ChannelPicker({ value, onChange }: ChannelPickerProps) {
  return (
    <div className="content-mode" role="radiogroup" aria-label="Enviar por">
      {CHANNELS.map((channel) => (
        <button
          key={channel}
          type="button"
          role="radio"
          aria-checked={value === channel}
          className="report-filter__option"
          onClick={() => onChange(channel)}
        >
          {CHANNEL_LABELS[channel]}
        </button>
      ))}
    </div>
  )
}
