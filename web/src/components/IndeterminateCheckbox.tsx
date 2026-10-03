import type { IndeterminateCheckboxProps } from '../types/components'

// "Marcar todos" com o traço de parcial: indeterminate só existe como propriedade do DOM
export function IndeterminateCheckbox({ checked, indeterminate, label, onChange }: IndeterminateCheckboxProps) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(element) => {
        if (element) element.indeterminate = indeterminate
      }}
      onChange={onChange}
    />
  )
}
