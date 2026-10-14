// Formatação dos números do dashboard (contagem e taxa)

export const rateOf = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

export const formatRate = (value: number | null): string => (value === null ? '—' : `${Math.round(value * 100)}%`)

export const formatCount = (value: number): string => value.toLocaleString('pt-BR')
