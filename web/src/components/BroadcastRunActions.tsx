import { useCancelBroadcast, usePauseBroadcast, useRetryBroadcast } from '../hooks/useBroadcasts'
import type { BroadcastRun } from '../types/api'
import type { BroadcastRunActionsProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'

type RunActionMutation = ReturnType<typeof useCancelBroadcast>

function MutationError({ mutation }: { mutation: RunActionMutation }) {
  return mutation.isError ? <span className="run-actions__error" role="alert">{mutation.error.message}</span> : null
}

// Em andamento: Pausar (retoma depois) ou Abortar (encerra). Os dois param antes do próximo contato.
function RunningActions({ run }: { run: BroadcastRun }) {
  const pause = usePauseBroadcast()
  const cancel = useCancelBroadcast()
  return (
    <>
      <button type="button" disabled={pause.isPending} onClick={() => pause.mutate(run.id)}>Pausar</button>
      <ConfirmButton label="Abortar" confirmLabel="Confirmar: parar envio" isPending={cancel.isPending} onConfirm={() => cancel.mutate(run.id)} />
      <MutationError mutation={pause} />
      <MutationError mutation={cancel} />
    </>
  )
}

// Reenvia só para quem não recebeu (falhas + pendentes): quem já está como enviado nunca recebe de novo.
// Pausado/interrompido → "Retomar"; encerrado com falhas/pendentes → "Reprocessar". Mesmo endpoint.
function RetryAction({ run, label }: { run: BroadcastRun; label: string }) {
  const retry = useRetryBroadcast()
  const notReceived = run.total - run.sent
  if (notReceived === 0) return null
  return (
    <>
      <ConfirmButton
        tone="primary"
        className="run-actions__retry"
        label={`${label} (${notReceived})`}
        confirmLabel={`Enviar só para os ${notReceived} que não receberam?`}
        isPending={retry.isPending}
        onConfirm={() => retry.mutate(run.id)}
      />
      <MutationError mutation={retry} />
    </>
  )
}

function PausedActions({ run }: { run: BroadcastRun }) {
  const cancel = useCancelBroadcast()
  return (
    <>
      <RetryAction run={run} label="Retomar" />
      <ConfirmButton label="Cancelar" confirmLabel="Confirmar: encerrar disparo" isPending={cancel.isPending} onConfirm={() => cancel.mutate(run.id)} />
      <MutationError mutation={cancel} />
    </>
  )
}

function ScheduledActions({ run }: { run: BroadcastRun }) {
  const cancel = useCancelBroadcast()
  return (
    <>
      <ConfirmButton label="Cancelar programação" confirmLabel="Confirmar cancelamento" isPending={cancel.isPending} onConfirm={() => cancel.mutate(run.id)} />
      <MutationError mutation={cancel} />
    </>
  )
}

function AwaitingActions({ run }: { run: BroadcastRun }) {
  const cancel = useCancelBroadcast()
  return (
    <>
      <RetryAction run={run} label="Reprocessar" />
      <ConfirmButton label="Cancelar" confirmLabel="Confirmar: encerrar quem ainda aguarda resposta" isPending={cancel.isPending} onConfirm={() => cancel.mutate(run.id)} />
      <MutationError mutation={cancel} />
    </>
  )
}

function StatusActions({ run }: { run: BroadcastRun }) {
  if (run.status === 'running') return <RunningActions run={run} />
  if (run.status === 'paused') return <PausedActions run={run} />
  if (run.status === 'awaiting') return <AwaitingActions run={run} />
  return <RetryAction run={run} label={run.status === 'interrupted' ? 'Retomar' : 'Reprocessar'} />
}

export function BroadcastRunActions({ run, isReportOpen, onOpenReport }: BroadcastRunActionsProps) {
  return (
    <div className="run-actions">
      {run.status === 'scheduled' ? <ScheduledActions run={run} /> : (
        <>
          <button type="button" className="row-actions__primary" aria-pressed={isReportOpen} onClick={() => onOpenReport(run.id)}>
            Relatório
          </button>
          <StatusActions run={run} />
        </>
      )}
    </div>
  )
}
