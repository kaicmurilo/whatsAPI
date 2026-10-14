import type { DownAlertSettingsProps } from '../types/components'
import { SettingToggle } from './SettingToggle'

const DEFAULT_MESSAGE = '⚠️ A instância {instancia} está fora do ar há {minutos} min ({status}, desde {desde}).'
const MESSAGE_MAX = 1000

const PLACEHOLDERS = [
  { token: '{instancia}', hint: 'nome da instância' },
  { token: '{status}', hint: 'desconectada, deslogada…' },
  { token: '{minutos}', hint: 'minutos fora do ar' },
  { token: '{desde}', hint: 'data e hora da queda' },
]

// Campo vazio é guardado como null: o servidor usa a mensagem padrão
const emptyToNull = (text: string): string | null => (text.trim() === '' ? null : text)

export function DownAlertSettings({ draft, onChange }: DownAlertSettingsProps) {
  return (
    <section className="settings__section settings__section--span" aria-labelledby="settings-down-alert">
      <h2 id="settings-down-alert" className="settings__legend">Aviso de instância fora do ar</h2>
      <SettingToggle
        checked={draft.downAlertEnabled}
        title="Avisar quando uma instância ficar mais de 5 minutos fora do ar"
        onChange={(downAlertEnabled) => onChange({ ...draft, downAlertEnabled })}
      >
        O aviso sai por outra instância conectada da conta (a que caiu não consegue avisar). Para grupo, só por uma que participa dele. Um aviso por queda; remover ou encerrar de propósito não avisa.
      </SettingToggle>
      <label className="field">
        <span className="field__label">Número ou grupo</span>
        <input
          className="field__input"
          value={draft.downAlertChatId ?? ''}
          placeholder="5511999998888 ou 120363...@g.us"
          autoComplete="off"
          spellCheck={false}
          required={draft.downAlertEnabled}
          onChange={(event) => onChange({ ...draft, downAlertChatId: emptyToNull(event.target.value) })}
        />
      </label>
      <label className="field">
        <span className="field__label">Mensagem</span>
        <textarea
          className="field__input"
          rows={3}
          maxLength={MESSAGE_MAX}
          placeholder={DEFAULT_MESSAGE}
          value={draft.downAlertMessage ?? ''}
          onChange={(event) => onChange({ ...draft, downAlertMessage: emptyToNull(event.target.value) })}
        />
      </label>
      <p className="settings__hint">
        Vazio usa a mensagem padrão. Marcadores:{' '}
        {PLACEHOLDERS.map(({ token, hint }, index) => (
          <span key={token}>
            {index > 0 ? ', ' : null}
            <code>{token}</code> ({hint})
          </span>
        ))}
        .
      </p>
    </section>
  )
}
