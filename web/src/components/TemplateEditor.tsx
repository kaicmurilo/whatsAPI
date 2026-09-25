import { useState, type FormEvent } from 'react'
import { useSaveTemplate, useTemplate } from '../hooks/useTemplates'
import { describeDeliveryOrder } from '../lib/templatePreview'
import type { TemplateFile } from '../types/api'
import type { TemplateEditorLoaderProps, TemplateEditorProps } from '../types/components'
import { TemplateAttachments } from './TemplateAttachments'

const MAX_TEXT_LENGTH = 4096

export function TemplateEditor({ templateId, initialName, initialText, initialAudioAsVoice, initialFiles, onDone }: TemplateEditorProps) {
  const [name, setName] = useState(initialName)
  const [text, setText] = useState(initialText)
  const [audioAsVoice, setAudioAsVoice] = useState(initialAudioAsVoice)
  const [files, setFiles] = useState<TemplateFile[]>(initialFiles)
  const saveTemplate = useSaveTemplate()
  const steps = describeDeliveryOrder(text, files, audioAsVoice)
  const hasAudio = files.some((file) => file.mimetype.startsWith('audio/'))
  const canSave = name.trim().length > 0 && steps.length > 0 && !saveTemplate.isPending

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    saveTemplate.mutate(
      { templateId, input: { name: name.trim(), text: text.trim(), audioAsVoice, fileIds: files.map((file) => file.id) } },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="list-editor template-editor" onSubmit={handleSubmit}>
      <header className="list-editor__header">
        <h2 className="list-editor__title">{templateId ? 'Editar mensagem' : 'Nova mensagem'}</h2>
        <button type="button" className="list-editor__cancel" onClick={onDone}>Cancelar</button>
      </header>

      <label className="field">
        <span className="field__label">Nome do modelo</span>
        <input className="field__input" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Texto (opcional)</span>
        <textarea className="field__input broadcast-send__text" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_TEXT_LENGTH} rows={4} />
      </label>

      <TemplateAttachments files={files} onChange={setFiles} />

      {hasAudio ? (
        <label className="pacing__toggle">
          <input type="checkbox" checked={audioAsVoice} onChange={(event) => setAudioAsVoice(event.target.checked)} />
          <span>Enviar áudio como mensagem de voz (aparece como áudio gravado)</span>
        </label>
      ) : null}

      <div className="template-editor__preview">
        <span className="field__label">Cada contato recebe</span>
        {steps.length > 0 ? (
          <ol>{steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
        ) : <p>Escreva um texto ou adicione ao menos um anexo.</p>}
      </div>

      {saveTemplate.isError ? <p className="list-editor__error" role="alert">{saveTemplate.error.message}</p> : null}
      <button type="submit" className="list-editor__save" disabled={!canSave}>
        {saveTemplate.isPending ? 'Salvando…' : 'Salvar mensagem'}
      </button>
    </form>
  )
}

// Edição: carrega o modelo antes de montar o editor (estado inicial pronto, sem efeito de sincronização)
export function TemplateEditorLoader({ templateId, onDone }: TemplateEditorLoaderProps) {
  const template = useTemplate(templateId)
  if (template.isError) return <p className="list-editor__error" role="alert">{template.error.message}</p>
  if (!template.data) return <p className="list-editor__loading">Carregando mensagem…</p>
  return (
    <TemplateEditor
      templateId={templateId}
      initialName={template.data.name}
      initialText={template.data.text ?? ''}
      initialAudioAsVoice={template.data.audioAsVoice}
      initialFiles={template.data.files}
      onDone={onDone}
    />
  )
}
