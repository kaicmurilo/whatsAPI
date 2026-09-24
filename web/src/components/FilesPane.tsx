import { useDeleteFile, useFiles } from '../hooks/useFiles'
import { fileKindLabel, formatBytes, formatDateTime } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { PanelFile } from '../types/api'
import type { DataTableColumn, TablePaneProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { FileUploadButton } from './FileUploadButton'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const getFileKey = (file: PanelFile): string => file.id

function FileDeleteAction({ file }: { file: PanelFile }) {
  const deleteFile = useDeleteFile()
  return (
    <ConfirmButton label="Excluir" confirmLabel="Confirmar exclusão" isPending={deleteFile.isPending} onConfirm={() => deleteFile.mutate(file.id)} />
  )
}

const FILE_COLUMNS: DataTableColumn<PanelFile>[] = [
  { key: 'name', header: 'Arquivo', render: (file) => <span className="files__name">{file.name}</span> },
  { key: 'kind', header: 'Tipo', render: (file) => <span className="files__meta">{fileKindLabel(file.mimetype)}</span> },
  { key: 'size', header: 'Tamanho', render: (file) => <span className="files__meta">{formatBytes(file.sizeBytes)}</span> },
  { key: 'created', header: 'Enviado em', render: (file) => <span className="files__meta">{formatDateTime(file.createdAt)}</span> },
  { key: 'actions', header: 'Ações', align: 'end', render: (file) => <FileDeleteAction file={file} /> },
]

export function FilesPane({ page, search, onPageChange, onSearchChange }: TablePaneProps) {
  const files = useFiles({ page, search })
  const items = files.data?.items ?? []
  const limitNote = files.data ? ` Limite de ${formatBytes(files.data.limitBytes)} por arquivo.` : ''

  return (
    <section className="library" aria-labelledby="files-title">
      <header className="library__header">
        <p className="library__eyebrow">Biblioteca</p>
        <h1 id="files-title" className="library__title">Arquivos</h1>
        <p className="library__note">
          Envie uma vez e reutilize nas conversas e nas transmissões.{limitNote} Vídeos e imagens chegam com play/preview no chat (até 64 MB).
        </p>
      </header>

      <div className="library__toolbar">
        <FileUploadButton label="+ Enviar arquivo" className="library__upload" />
        <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar pelo nome" label="Buscar arquivos" />
      </div>

      {files.isError ? <EmptyState title="Não foi possível carregar os arquivos">{files.error.message}</EmptyState> : null}
      {files.isSuccess && items.length === 0 ? (
        <EmptyState title={search ? 'Nenhum arquivo encontrado' : 'Biblioteca vazia'}>
          {search ? null : 'Envie um catálogo, tabela de preços ou qualquer arquivo que você manda com frequência.'}
        </EmptyState>
      ) : null}
      {items.length > 0 ? <DataTable caption="Arquivos da biblioteca" columns={FILE_COLUMNS} rows={items} getRowKey={getFileKey} isBusy={files.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={files.data?.total ?? 0} label="Paginação dos arquivos" onPageChange={onPageChange} />
    </section>
  )
}
