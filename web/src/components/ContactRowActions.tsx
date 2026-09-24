import { useDeleteContact } from '../hooks/useContacts'
import type { ContactRowActionsProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'

export function ContactRowActions({ contact, canChat, isResolving, onChat }: ContactRowActionsProps) {
  const deleteContact = useDeleteContact()

  return (
    <div className="row-actions">
      <button
        type="button"
        className="row-actions__primary"
        disabled={!canChat || isResolving}
        title={canChat ? undefined : 'Selecione uma instância conectada para conversar'}
        onClick={() => onChat(contact)}
      >
        {isResolving ? 'Abrindo…' : 'Conversar'}
      </button>
      <ConfirmButton
        label="Excluir"
        confirmLabel="Confirmar exclusão"
        isPending={deleteContact.isPending}
        onConfirm={() => deleteContact.mutate(contact.id)}
      />
    </div>
  )
}
