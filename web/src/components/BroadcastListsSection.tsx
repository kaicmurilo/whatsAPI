import { useState } from 'react'
import { useBroadcastLists, useDeleteBroadcastList } from '../hooks/useBroadcasts'
import { formatDateTime } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { BroadcastListSummary } from '../types/api'
import type { BroadcastListRowActionsProps, DataTableColumn, TablePaneProps } from '../types/components'
import { BroadcastListEditor, BroadcastListEditorLoader } from './BroadcastListEditor'
import { ConfirmButton } from './ConfirmButton'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

// null = fechado; 'new' = criando; id = editando
type EditorTarget = null | 'new' | string

const getListKey = (list: BroadcastListSummary): string => list.id

function BroadcastListRowActions({ list, onEdit }: BroadcastListRowActionsProps) {
  const deleteList = useDeleteBroadcastList()
  return (
    <div className="row-actions">
      <button type="button" className="row-actions__primary" onClick={() => onEdit(list.id)}>Editar</button>
      <ConfirmButton label="Excluir" confirmLabel="Confirmar exclusão" isPending={deleteList.isPending} onConfirm={() => deleteList.mutate(list.id)} />
    </div>
  )
}

export function BroadcastListsSection({ page, search, onPageChange, onSearchChange }: TablePaneProps) {
  const [editorTarget, setEditorTarget] = useState<EditorTarget>(null)
  const lists = useBroadcastLists({ page, search })
  const items = lists.data?.items ?? []
  const closeEditor = () => setEditorTarget(null)

  const columns: DataTableColumn<BroadcastListSummary>[] = [
    { key: 'name', header: 'Lista', render: (list) => <span className="broadcasts__strong">{list.name}</span> },
    { key: 'members', header: 'Contatos', render: (list) => <span className="broadcasts__mono">{list.memberCount}</span> },
    { key: 'updated', header: 'Atualizada', render: (list) => <span className="broadcasts__mono">{formatDateTime(list.updatedAt)}</span> },
    { key: 'actions', header: 'Ações', align: 'end', render: (list) => <BroadcastListRowActions list={list} onEdit={setEditorTarget} /> },
  ]

  return (
    <section className="broadcasts__section" aria-labelledby="lists-title">
      <header className="broadcasts__section-header">
        <h2 id="lists-title" className="broadcasts__section-title">Listas</h2>
        {editorTarget === null ? <button type="button" className="broadcasts__new" onClick={() => setEditorTarget('new')}>+ Nova lista</button> : null}
      </header>

      {editorTarget === 'new' ? <BroadcastListEditor listId={null} initialName="" initialMembers={[]} onDone={closeEditor} /> : null}
      {editorTarget !== null && editorTarget !== 'new' ? <BroadcastListEditorLoader key={editorTarget} listId={editorTarget} onDone={closeEditor} /> : null}

      <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar lista" label="Buscar listas de transmissão" />
      {lists.isError ? <EmptyState title="Não foi possível carregar as listas">{lists.error.message}</EmptyState> : null}
      {lists.isSuccess && items.length === 0 ? (
        <EmptyState title={search ? 'Nenhuma lista encontrada' : 'Nenhuma lista ainda'}>{search ? null : 'Crie uma lista escolhendo contatos da agenda.'}</EmptyState>
      ) : null}
      {items.length > 0 ? <DataTable caption="Listas de transmissão" columns={columns} rows={items} getRowKey={getListKey} isBusy={lists.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={lists.data?.total ?? 0} label="Paginação das listas" onPageChange={onPageChange} />
    </section>
  )
}
