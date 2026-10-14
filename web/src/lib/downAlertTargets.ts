import type { DownAlertTarget } from '../types/api'

// Mesma chave do servidor: telefone vira @c.us, grupo usa o id. Evita o mesmo destino duas vezes.
export const targetKey = (target: DownAlertTarget): string =>
  target.kind === 'group' ? target.chatId : `${target.phone}@c.us`

export const hasTarget = (targets: DownAlertTarget[], candidate: DownAlertTarget): boolean =>
  targets.some((target) => targetKey(target) === targetKey(candidate))

export const toggleTarget = (targets: DownAlertTarget[], candidate: DownAlertTarget): DownAlertTarget[] =>
  hasTarget(targets, candidate)
    ? targets.filter((target) => targetKey(target) !== targetKey(candidate))
    : [...targets, candidate]
