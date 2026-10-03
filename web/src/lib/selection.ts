// Seleção de linhas que sobrevive à troca de página e à busca: sempre devolve um Set novo
export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function setSelectedMany(selected: ReadonlySet<string>, ids: string[], isSelected: boolean): Set<string> {
  const next = new Set(selected)
  for (const id of ids) {
    if (isSelected) next.add(id)
    else next.delete(id)
  }
  return next
}

export type PageSelectionState = 'none' | 'some' | 'all'

export function pageSelectionState(selected: ReadonlySet<string>, ids: string[]): PageSelectionState {
  const count = ids.filter((id) => selected.has(id)).length
  if (count === 0) return 'none'
  return count === ids.length ? 'all' : 'some'
}
