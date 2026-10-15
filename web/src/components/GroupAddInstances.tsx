import { useState } from 'react'
import { useAddGroupMembers } from '../hooks/useGroups'
import { ADD_STATUS_LABEL } from '../lib/groupLabels'
import type { GroupAddInstancesProps } from '../types/components'
import { InstancePicker } from './InstancePicker'

// Uma instância sua que é admin do grupo adiciona as outras; só aparecem as que ainda não estão nele
export function GroupAddInstances({ group, sessions }: GroupAddInstancesProps) {
  const [draft, setDraft] = useState<string[] | null>(null)
  const add = useAddGroupMembers(group.chatId)
  const candidates = sessions.filter((session) => !group.memberSessionIds.includes(session.sessionId))

  if (group.adminSessionIds.length === 0) return <span className="files__meta">Nenhuma instância sua é admin</span>
  if (candidates.length === 0) return <span className="files__meta">Todas já estão no grupo</span>

  if (!draft) {
    return (
      <span className="run-content__instances">
        <button type="button" className="run-pacing__edit" onClick={() => setDraft([])}>Adicionar instâncias</button>
        {add.isSuccess ? (
          <span className="files__meta">
            {add.data.results.map((result) => `${result.sessionId}: ${ADD_STATUS_LABEL[result.status]}`).join(' · ')}
          </span>
        ) : null}
      </span>
    )
  }

  const handleAdd = () => add.mutate(draft, { onSuccess: () => setDraft(null) })

  return (
    <div className="run-instances">
      <InstancePicker
        sessions={candidates}
        selectedIds={draft}
        onChange={setDraft}
        allowDisconnected={false}
        isDisabled={add.isPending}
        legend={`Adicionar por ${group.adminSessionIds.join(', ')} (admin)`}
      />
      <span className="run-pacing__hint">Só instâncias conectadas. Quem bloqueou ser adicionado recebe um convite.</span>
      <div className="run-pacing__actions">
        <button type="button" className="row-actions__primary" disabled={draft.length === 0 || add.isPending} onClick={handleAdd}>
          {add.isPending ? 'Adicionando…' : 'Adicionar'}
        </button>
        <button type="button" disabled={add.isPending} onClick={() => setDraft(null)}>Cancelar</button>
      </div>
      {add.isError ? <span className="run-actions__error" role="alert">{add.error.message}</span> : null}
    </div>
  )
}
