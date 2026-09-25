import { useCancelBroadcast, useRetryBroadcast } from '../hooks/useBroadcasts'
import type { BroadcastRunActionsProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'

// Reprocessa só quem não recebeu: quem já está como enviado nunca recebe de novo
export function BroadcastRunActions({ run, isReportOpen, onOpenReport }: BroadcastRunActionsProps) {
  const retry = useRetryBroadcast()
  const cancel = useCancelBroadcast()
  const pending = run.total - run.sent
  const isRunning = run.status === 'running'
  const isScheduled = run.status === 'scheduled'
  const canRetry = !isRunning && !isScheduled && pending > 0

  return (
    <div className="run-actions">
      {isScheduled ? (
        <ConfirmButton
          label="Cancelar programação"
          confirmLabel="Confirmar cancelamento"
          isPending={cancel.isPending}
          onConfirm={() => cancel.mutate(run.id)}
        />
      ) : (
        <button type="button" className="row-actions__primary" aria-pressed={isReportOpen} onClick={() => onOpenReport(run.id)}>
          Relatório
        </button>
      )}
      {isRunning ? (
        <ConfirmButton
          label="Abortar"
          confirmLabel="Confirmar: parar envio"
          isPending={cancel.isPending}
          onConfirm={() => cancel.mutate(run.id)}
        />
      ) : null}
      {canRetry ? <ConfirmButton
        tone="primary"
        className="run-actions__retry"
        label={`Reprocessar (${pending})`}
        confirmLabel={`Reenviar para ${pending}?`}
        isPending={retry.isPending}
        onConfirm={() => retry.mutate(run.id)}
      /> : null}
      {retry.isError ? <span className="run-actions__error" role="alert">{retry.error.message}</span> : null}
      {cancel.isError ? <span className="run-actions__error" role="alert">{cancel.error.message}</span> : null}
    </div>
  )
}
