import type { BatchSettingsProps } from '../types/components'
import { SettingToggle } from './SettingToggle'

const WINDOW_MIN = 1
const WINDOW_MAX = 60

// Campo vazio ou fora do intervalo: o servidor recusa com a mensagem do limite
const parseMinutes = (text: string): number => Math.trunc(Number(text))

export function BatchSettings({ draft, onChange }: BatchSettingsProps) {
  return (
    <section className="settings__section settings__section--span" aria-labelledby="settings-batch">
      <h2 id="settings-batch" className="settings__legend">Agrupamento de mensagens</h2>
      <div className="settings__pair">
        <SettingToggle
          checked={draft.batchEnabled}
          title="Juntar mensagens para o mesmo grupo ou contato"
          onChange={(batchEnabled) => onChange({ ...draft, batchEnabled })}
        >
          Vale para textos enviados pela API (/client/sendMessage e /client/sendMessageBalanced). O primeiro texto abre a janela; os que chegarem até o fim dela saem juntos numa mensagem só, separados por uma linha em branco. Mídia, localização e enquete saem na hora.
        </SettingToggle>
        <label className="field">
          <span className="field__label">Esperar (minutos, {WINDOW_MIN}–{WINDOW_MAX})</span>
          <input
            className="field__input"
            type="number"
            min={WINDOW_MIN}
            max={WINDOW_MAX}
            value={draft.batchWindowMinutes}
            onChange={(event) => onChange({ ...draft, batchWindowMinutes: parseMinutes(event.target.value) })}
          />
          <span className="settings__hint">Com o agrupamento ligado, a API responde 202 com o horário previsto (sendAt) em vez da mensagem enviada.</span>
        </label>
      </div>
    </section>
  )
}
