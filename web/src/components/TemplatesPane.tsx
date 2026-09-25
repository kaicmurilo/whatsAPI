import { useState } from 'react'
import { useDeleteTemplate, useTemplates } from '../hooks/useTemplates'
import { formatDateTime } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { MessageTemplateSummary } from '../types/api'
import type { DataTableColumn, TablePaneProps, TemplateRowActionsProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'
import { TemplateEditor, TemplateEditorLoader } from './TemplateEditor'

// null = fechado; 'new' = criando; id = editando
type EditorTarget = null | 'new' | string

const getTemplateKey = (template: MessageTemplateSummary): string => template.id
const PREVIEW_LENGTH = 70

const describeTemplate = (template: MessageTemplateSummary): string => {
  const text = template.text ? `“${template.text.slice(0, PREVIEW_LENGTH)}${template.text.length > PREVIEW_LENGTH ? '…' : ''}”` : 'Sem texto'
  return template.attachmentCount > 0 ? `${text} · 📎 ${template.attachmentCount}` : text
}

function TemplateRowActions({ template, onEdit }: TemplateRowActionsProps) {
  const deleteTemplate = useDeleteTemplate()
  return (
    <div className="row-actions">
      <button type="button" className="row-actions__primary" onClick={() => onEdit(template.id)}>Editar</button>
      <ConfirmButton label="Excluir" confirmLabel="Confirmar exclusão" isPending={deleteTemplate.isPending} onConfirm={() => deleteTemplate.mutate(template.id)} />
    </div>
  )
}

export function TemplatesPane({ page, search, onPageChange, onSearchChange }: TablePaneProps) {
  const [editorTarget, setEditorTarget] = useState<EditorTarget>(null)
  const templates = useTemplates({ page, search })
  const items = templates.data?.items ?? []
  const closeEditor = () => setEditorTarget(null)

  const columns: DataTableColumn<MessageTemplateSummary>[] = [
    { key: 'name', header: 'Mensagem', render: (template) => <span className="broadcasts__strong">{template.name}</span> },
    { key: 'content', header: 'Conteúdo', render: (template) => <span className="broadcasts__content">{describeTemplate(template)}</span> },
    { key: 'updated', header: 'Atualizada', render: (template) => <span className="broadcasts__mono">{formatDateTime(template.updatedAt)}</span> },
    { key: 'actions', header: 'Ações', align: 'end', render: (template) => <TemplateRowActions template={template} onEdit={setEditorTarget} /> },
  ]

  return (
    <section className="library" aria-labelledby="templates-title">
      <header className="library__header">
        <p className="library__eyebrow">Mensagens</p>
        <h1 id="templates-title" className="library__title">Modelos de mensagem</h1>
        <p className="library__note">
          Monte uma vez (texto + áudio, vídeo, imagem ou documento) e use em qualquer lista de transmissão.
          O texto vai como legenda do primeiro vídeo, imagem ou documento; áudios chegam como mensagens próprias.
        </p>
      </header>

      <div className="library__toolbar">
        {editorTarget === null ? <button type="button" className="library__upload" onClick={() => setEditorTarget('new')}>+ Nova mensagem</button> : null}
        <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar pelo nome ou texto" label="Buscar mensagens" />
      </div>

      {editorTarget === 'new' ? (
        <TemplateEditor templateId={null} initialName="" initialText="" initialAudioAsVoice initialFiles={[]} onDone={closeEditor} />
      ) : null}
      {editorTarget !== null && editorTarget !== 'new' ? <TemplateEditorLoader key={editorTarget} templateId={editorTarget} onDone={closeEditor} /> : null}

      {templates.isError ? <EmptyState title="Não foi possível carregar as mensagens">{templates.error.message}</EmptyState> : null}
      {templates.isSuccess && items.length === 0 ? (
        <EmptyState title={search ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem salva'}>{search ? null : 'Crie a primeira em “+ Nova mensagem”.'}</EmptyState>
      ) : null}
      {items.length > 0 ? <DataTable caption="Modelos de mensagem" columns={columns} rows={items} getRowKey={getTemplateKey} isBusy={templates.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={templates.data?.total ?? 0} label="Paginação das mensagens" onPageChange={onPageChange} />
    </section>
  )
}
