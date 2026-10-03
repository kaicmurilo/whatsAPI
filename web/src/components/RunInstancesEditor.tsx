import { useState } from 'react'
import { useUpdateRunSessions } from '../hooks/useBroadcasts'
import { instanceTitle } from '../lib/sessionLabel'
import type { BroadcastRun, SenderInstance } from '../types/api'
import type { RunInstancesEditorProps } from '../types/components'
import { InstancePicker } from './InstancePicker'

export const sessionIdsOf = (run: BroadcastRun): string[] =>
  run.sessionIds?.length ? run.sessionIds : [run.sessionId]

const hasSendsAhead = (run: BroadcastRun): boolean =>
  run.status === 'scheduled' || run.status === 'awaiting' || run.total > run.sent

// Bot aparece como @username; id sem instância conhecida (removida) aparece cru
const describeInstances = (sessionIds: string[], sessions: SenderInstance[]): string => {
  const titles = sessionIds.map((sessionId) => {
    const session = sessions.find((candidate) => candidate.sessionId === sessionId)
    return session ? instanceTitle(session) : sessionId
  })
  if (titles.length === 0) return 'Nenhuma instância'
  if (titles.length <= 2) return titles.join(', ')
  return `${titles.slice(0, 2).join(', ')} +${titles.length - 2}`
}

const editHint = (run: BroadcastRun): string => {
  if (run.status === 'scheduled') return 'O envio só começa quando todas as selecionadas estiverem conectadas.'
  if (run.status === 'running') return 'Vale a partir do próximo contato. Desconectada fica de fora até voltar.'
  return 'No retomar, desconectada fica de fora até voltar.'
}

// Instâncias do rodízio no histórico. Em andamento, a troca vale no próximo contato.
export function RunInstancesEditor({ run, sessions }: RunInstancesEditorProps) {
  const [draft, setDraft] = useState<string[] | null>(null)
  const update = useUpdateRunSessions(run.id)
  const current = sessionIdsOf(run)

  if (!draft) {
    return (
      <span className="run-content__instances">
        {describeInstances(current, sessions)}
        {hasSendsAhead(run) ? <button type="button" className="run-pacing__edit" onClick={() => setDraft(current)}>Editar instâncias</button> : null}
      </span>
    )
  }

  const handleSave = () => update.mutate(draft, { onSuccess: () => setDraft(null) })

  return (
    <div className="run-instances">
      <InstancePicker sessions={sessions} selectedIds={draft} onChange={setDraft} allowDisconnected isDisabled={update.isPending} />
      <span className="run-pacing__hint">{editHint(run)}</span>
      <div className="run-pacing__actions">
        <button type="button" className="row-actions__primary" disabled={draft.length === 0 || update.isPending} onClick={handleSave}>Salvar instâncias</button>
        <button type="button" disabled={update.isPending} onClick={() => setDraft(null)}>Cancelar</button>
      </div>
      {update.isError ? <span className="run-actions__error" role="alert">{update.error.message}</span> : null}
    </div>
  )
}
