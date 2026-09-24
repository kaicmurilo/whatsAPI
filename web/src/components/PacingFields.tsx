import { MAX_PACING_SECONDS, MIN_PACING_SECONDS, PACING_PRESETS, presetOf, type PacingPresetKey } from '../lib/pacing'
import type { PacingFieldsProps } from '../types/components'

const toSeconds = (value: string): number => (value === '' ? Number.NaN : Number(value))

// Ritmo do disparo: preset ou faixa personalizada + ordem aleatória
export function PacingFields({ value, onChange, isDisabled = false }: PacingFieldsProps) {
  const preset = presetOf(value)

  const handlePreset = (key: PacingPresetKey) => {
    const chosen = PACING_PRESETS.find((candidate) => candidate.key === key)
    if (chosen) onChange({ ...value, minSeconds: chosen.minSeconds, maxSeconds: chosen.maxSeconds })
    else onChange({ ...value }) // "Personalizado" mantém a faixa atual, só libera os campos
  }

  return (
    <fieldset className="pacing" disabled={isDisabled}>
      <legend className="field__label">Intervalo entre envios</legend>
      <select className="field__input" value={preset} onChange={(event) => handlePreset(event.target.value as PacingPresetKey)} aria-label="Ritmo do envio">
        {PACING_PRESETS.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
        <option value="custom">Personalizado</option>
      </select>

      <div className="pacing__range">
        <label className="pacing__bound">
          <span>de</span>
          <input
            type="number"
            className="field__input"
            min={MIN_PACING_SECONDS}
            max={MAX_PACING_SECONDS}
            value={Number.isNaN(value.minSeconds) ? '' : value.minSeconds}
            onChange={(event) => onChange({ ...value, minSeconds: toSeconds(event.target.value) })}
            aria-label="Intervalo mínimo em segundos"
          />
        </label>
        <label className="pacing__bound">
          <span>a</span>
          <input
            type="number"
            className="field__input"
            min={MIN_PACING_SECONDS}
            max={MAX_PACING_SECONDS}
            value={Number.isNaN(value.maxSeconds) ? '' : value.maxSeconds}
            onChange={(event) => onChange({ ...value, maxSeconds: toSeconds(event.target.value) })}
            aria-label="Intervalo máximo em segundos"
          />
        </label>
        <span className="pacing__unit">segundos (sorteado a cada envio)</span>
      </div>

      <label className="pacing__toggle">
        <input type="checkbox" checked={value.randomOrder} onChange={(event) => onChange({ ...value, randomOrder: event.target.checked })} />
        <span>Ordem aleatória dos contatos</span>
      </label>
    </fieldset>
  )
}
