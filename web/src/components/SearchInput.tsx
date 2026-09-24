import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { SearchInputProps } from '../types/components'

const SEARCH_DEBOUNCE_MS = 300
const MAX_SEARCH_LENGTH = 100

// Digitação fica local; só o valor estabilizado vai para a URL (evita um request por tecla)
export function SearchInput({ value, onSearchChange, placeholder, label }: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const debouncedDraft = useDebouncedValue(draft.trim(), SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (debouncedDraft !== value) onSearchChange(debouncedDraft)
  }, [debouncedDraft, value, onSearchChange])

  return (
    <input
      type="search"
      className="search-input"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      maxLength={MAX_SEARCH_LENGTH}
    />
  )
}
