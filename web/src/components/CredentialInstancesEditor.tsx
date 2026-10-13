import { useState } from 'react'
import { useUpdateCredentialSessions } from '../hooks/useApiCredentials'
import { useSessions } from '../hooks/usePanelData'
import type { ApiCredential } from '../types/api'
import type { CredentialInstancesEditorProps } from '../types/components'
import { InstancePicker } from './InstancePicker'

const instancesLabel = (credential: ApiCredential): string => (credential.sessionIds ? credential.sessionIds.join(', ') : 'Todas')

// Mesma regra da criação: nada marcado = todas, inclusive as criadas depois. Vale na próxima chamada da aplicação.
export function CredentialInstancesEditor({ credential }: CredentialInstancesEditorProps) {
  const [draft, setDraft] = useState<string[] | null>(null)
  const sessions = useSessions()
  const update = useUpdateCredentialSessions(credential.id)

  if (!draft) {
    return (
      <span className="run-content__instances">
        <span className="files__meta">{instancesLabel(credential)}</span>
        <button type="button" className="run-pacing__edit" onClick={() => setDraft(credential.sessionIds ?? [])}>Editar instâncias</button>
      </span>
    )
  }

  const handleSave = () => update.mutate(draft.length > 0 ? draft : null, { onSuccess: () => setDraft(null) })

  return (
    <div className="run-instances">
      <InstancePicker sessions={sessions.data ?? []} selectedIds={draft} onChange={setDraft} allowDisconnected isDisabled={update.isPending} />
      <span className="run-pacing__hint">Nada marcado libera todas. A troca vale na próxima chamada da aplicação, sem trocar a chave.</span>
      <div className="run-pacing__actions">
        <button type="button" className="row-actions__primary" disabled={update.isPending} onClick={handleSave}>Salvar instâncias</button>
        <button type="button" disabled={update.isPending} onClick={() => setDraft(null)}>Cancelar</button>
      </div>
      {update.isError ? <span className="run-actions__error" role="alert">{update.error.message}</span> : null}
    </div>
  )
}
