import { useQueuedRecipients, useRemoveQueuedRecipient } from '../hooks/useBroadcastQueue'
import { formatPhone } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { BroadcastRunStatus, QueuedRecipient } from '../types/api'
import type { DataTableColumn, QueuePaneProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const RUN_STATUS_LABELS: Partial<Record<BroadcastRunStatus, string>> = {
  running: 'Enviando',
  paused: 'Pausado',
  interrupted: 'Interrompido',
}

const queueKeyOf = (item: QueuedRecipient): string => `${item.runId}:${item.position}`

const buildQueueColumns = (onRemove: (item: QueuedRecipient) => void, removingKey: string | null): DataTableColumn<QueuedRecipient>[] => [
  { key: 'name', header: 'Contato', render: (item) => <span className="broadcasts__strong">{item.name}</span> },
  { key: 'phone', header: 'Telefone', render: (item) => <span className="contacts__phone">{formatPhone(item.phone)}</span> },
  { key: 'list', header: 'Lista', render: (item) => item.listName },
  { key: 'channel', header: 'Canal', render: (item) => (item.channel === 'telegram' ? 'Telegram' : 'WhatsApp') },
  { key: 'run', header: 'Disparo', render: (item) => <span className="broadcasts__mono">#{item.runId} · {RUN_STATUS_LABELS[item.runStatus] ?? item.runStatus}</span> },
  {
    key: 'actions',
    header: 'Ações',
    align: 'end',
    render: (item) => (
      <ConfirmButton
        label="Remover da fila"
        confirmLabel="Confirmar"
        isPending={removingKey === queueKeyOf(item)}
        onConfirm={() => onRemove(item)}
      />
    ),
  },
]

// Fila de envio: contatos que ainda vão receber, de todos os disparos abertos. Remover tira só aquele contato.
export function QueuePane({ page, search, onPageChange, onSearchChange }: QueuePaneProps) {
  const queue = useQueuedRecipients({ page, search })
  const remove = useRemoveQueuedRecipient()
  const items = queue.data?.items ?? []
  const removingKey = remove.isPending && remove.variables ? `${remove.variables.runId}:${remove.variables.position}` : null
  const columns = buildQueueColumns((item) => remove.mutate({ runId: item.runId, position: item.position }), removingKey)

  return (
    <section className="library" aria-labelledby="queue-title">
      <header className="library__header">
        <p className="library__eyebrow">Transmissão</p>
        <h1 id="queue-title" className="library__title">Fila de envio</h1>
        <p className="library__note">
          Contatos que ainda vão receber, na ordem dos disparos ({queue.data?.total ?? 0} na fila). Remover vale na hora, inclusive em disparo
          que está enviando; o contato não volta ao retomar.
        </p>
      </header>
      <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar por nome ou telefone" label="Buscar na fila" />
      {queue.isError ? <EmptyState title="Não foi possível carregar a fila">{queue.error.message}</EmptyState> : null}
      {remove.isError ? <p className="contacts__error" role="alert">{remove.error.message}</p> : null}
      {queue.isSuccess && items.length === 0 ? <EmptyState title={search ? 'Ninguém encontrado na fila' : 'Fila vazia'} /> : null}
      {items.length > 0 ? <DataTable caption="Fila de envio" columns={columns} rows={items} getRowKey={queueKeyOf} isBusy={queue.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={queue.data?.total ?? 0} label="Paginação da fila" onPageChange={onPageChange} />
    </section>
  )
}
