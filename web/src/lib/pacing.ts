import type { BroadcastPacing } from '../types/api'

export type PacingPresetKey = 'fast' | 'safe' | 'verySafe' | 'custom'

export interface PacingPreset {
  key: PacingPresetKey
  label: string
  minSeconds: number
  maxSeconds: number
}

// Mesmos limites do backend (broadcastPacing.js)
export const MIN_PACING_SECONDS = 3
export const MAX_PACING_SECONDS = 600

export const PACING_PRESETS: PacingPreset[] = [
  { key: 'fast', label: 'Rápido · 5–15 s (mais risco)', minSeconds: 5, maxSeconds: 15 },
  { key: 'safe', label: 'Seguro · 20–45 s', minSeconds: 20, maxSeconds: 45 },
  { key: 'verySafe', label: 'Muito seguro · 60–120 s', minSeconds: 60, maxSeconds: 120 },
]

export const DEFAULT_PACING: BroadcastPacing = { minSeconds: 20, maxSeconds: 45, randomOrder: true }

export const presetOf = (pacing: BroadcastPacing): PacingPresetKey =>
  PACING_PRESETS.find((preset) => preset.minSeconds === pacing.minSeconds && preset.maxSeconds === pacing.maxSeconds)?.key ?? 'custom'

export const isValidPacing = ({ minSeconds, maxSeconds }: BroadcastPacing): boolean =>
  Number.isInteger(minSeconds) && Number.isInteger(maxSeconds) &&
  minSeconds >= MIN_PACING_SECONDS && maxSeconds <= MAX_PACING_SECONDS && minSeconds <= maxSeconds

// Estimativa pela média da faixa: n contatos → n-1 esperas
export function estimateDurationMinutes(recipients: number, { minSeconds, maxSeconds }: BroadcastPacing): number {
  const averageWait = (minSeconds + maxSeconds) / 2
  return Math.max(1, Math.ceil((Math.max(recipients - 1, 0) * averageWait) / 60))
}

export const describePacing = ({ minSeconds, maxSeconds, randomOrder }: BroadcastPacing): string =>
  `${minSeconds}–${maxSeconds} s${randomOrder ? ' · ordem aleatória' : ''}`
