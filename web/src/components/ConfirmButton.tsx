import { useState } from 'react'
import type { ConfirmButtonProps } from '../types/components'

// Ação destrutiva/em massa em dois cliques (sem confirm() nativo): 1º arma, 2º confirma, perder o foco desarma
export function ConfirmButton({ label, confirmLabel, onConfirm, isPending = false, isDisabled = false, tone = 'danger', className }: ConfirmButtonProps) {
  const [isArmed, setIsArmed] = useState(false)

  const handleClick = () => {
    if (!isArmed) {
      setIsArmed(true)
      return
    }
    setIsArmed(false)
    onConfirm()
  }

  return (
    <button
      type="button"
      className={`confirm-button ${className ?? ''}`}
      data-tone={tone}
      data-armed={isArmed}
      disabled={isDisabled || isPending}
      onClick={handleClick}
      onBlur={() => setIsArmed(false)}
    >
      {isArmed ? confirmLabel : label}
    </button>
  )
}
