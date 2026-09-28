import { useState } from 'react'
import { useUpdateRunPacing } from '../hooks/useBroadcasts'
import { describePacing, isValidPacing } from '../lib/pacing'
import type { BroadcastPacing, BroadcastRun } from '../types/api'
import type { RunPacingEditorProps } from '../types/components'
import { PacingFields } from './PacingFields'

const pacingOfRun = (run: BroadcastRun): BroadcastPacing =>
  ({ minSeconds: run.delayMinSeconds, maxSeconds: run.delayMaxSeconds, randomOrder: run.randomOrder })

// Só faz sentido mudar o ritmo enquanto ainda há quem enviar (agora, depois do horário ou num Retomar/Reprocessar)
const hasSendsAhead = (run: BroadcastRun): boolean =>
  run.status === 'scheduled' || run.status === 'awaiting' || run.total > run.sent

// Ritmo do disparo no histórico, com edição inline. Em andamento: vale a partir da próxima espera.
export function RunPacingEditor({ run }: RunPacingEditorProps) {
  const [draft, setDraft] = useState<BroadcastPacing | null>(null)
  const update = useUpdateRunPacing(run.id)
  const current = pacingOfRun(run)

  if (!draft) {
    return (
      <span className="run-content__pacing">
        ⏱ {describePacing(current)}
        {hasSendsAhead(run) ? <button type="button" className="run-pacing__edit" onClick={() => setDraft(current)}>Editar</button> : null}
      </span>
    )
  }

  const handleSave = () => update.mutate(draft, { onSuccess: () => setDraft(null) })

  return (
    <div className="run-pacing">
      <PacingFields value={draft} onChange={setDraft} isDisabled={update.isPending} />
      {run.status === 'running' ? <span className="run-pacing__hint">Vale a partir do próximo contato; a ordem já sorteada não muda.</span> : null}
      <div className="run-pacing__actions">
        <button type="button" className="row-actions__primary" disabled={!isValidPacing(draft) || update.isPending} onClick={handleSave}>Salvar intervalo</button>
        <button type="button" disabled={update.isPending} onClick={() => setDraft(null)}>Cancelar</button>
      </div>
      {update.isError ? <span className="run-actions__error" role="alert">{update.error.message}</span> : null}
    </div>
  )
}
