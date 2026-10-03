import { useDeleteSession } from '../hooks/usePanelData'
import type { RemoveInstanceButtonProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'

// Instância do WhatsApp: desconecta o número, apaga a sessão e as mensagens salvas; sai do rodízio dos disparos
export function RemoveInstanceButton({ sessionId, onRemoved }: RemoveInstanceButtonProps) {
  const remove = useDeleteSession()
  return (
    <span className="remove-instance">
      <ConfirmButton
        label="Remover instância"
        confirmLabel="Confirmar: desconecta e apaga"
        isPending={remove.isPending}
        onConfirm={() => remove.mutate(sessionId, { onSuccess: onRemoved })}
      />
      {remove.isError ? <span className="run-actions__error" role="alert">{remove.error.message}</span> : null}
    </span>
  )
}
