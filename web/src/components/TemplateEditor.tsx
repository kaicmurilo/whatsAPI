import { useState, type FormEvent } from 'react'
import { useSaveTemplate, useTemplate } from '../hooks/useTemplates'
import { describeDeliveryOrder } from '../lib/templatePreview'
import type { TemplateFile } from '../types/api'
import type { TemplateEditorLoaderProps, TemplateEditorProps } from '../types/components'
import { TemplateAttachments } from './TemplateAttachments'

const MAX_TEXT_LENGTH = 4096

interface VariationDraft {
  id: string
  text: string
}

const draftVariation = (text: string): VariationDraft => ({ id: crypto.randomUUID(), text })

export function TemplateEditor({ templateId, initialName, initialText, initialVariations, initialAudioAsVoice, initialFiles, onDone }: TemplateEditorProps) {
  const [name, setName] = useState(initialName)
  const [text, setText] = useState(initialText)
  const [variations, setVariations] = useState<VariationDraft[]>(() => initialVariations.map(draftVariation))
  const [audioAsVoice, setAudioAsVoice] = useState(initialAudioAsVoice)
  const [files, setFiles] = useState<TemplateFile[]>(initialFiles)
  const saveTemplate = useSaveTemplate()
  const filledVariations = variations.map((item) => item.text.trim()).filter((item) => item.length > 0)
  const previewText = text.trim() || filledVariations[0] || ''
  const versionCount = (text.trim() ? 1 : 0) + filledVariations.length
  const steps = describeDeliveryOrder(previewText, files, audioAsVoice)
  const hasAudio = files.some((file) => file.mimetype.startsWith('audio/'))
  const canSave = name.trim().length > 0 && steps.length > 0 && !saveTemplate.isPending

  const updateVariation = (id: string, value: string) => {
    setVariations((current) => current.map((item) => (item.id === id ? { ...item, text: value } : item)))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    saveTemplate.mutate(
      {
        templateId,
        input: {
          name: name.trim(),
          text: text.trim(),
          variations: filledVariations,
          audioAsVoice,
          fileIds: files.map((file) => file.id),
        },
      },
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

      <div className="template-variations">
        <span className="field__label">Variações do texto</span>
        <p className="template-variations__note">
          Cada contato da lista recebe uma versão, em rodízio: o texto acima e estas variações, nesta ordem.
        </p>
        {variations.map((variation, index) => (
          <div key={variation.id} className="template-variations__item">
            <div className="template-variations__head">
              <label className="field__label" htmlFor={`variation-${variation.id}`}>Variação {index + 1}</label>
              <button type="button" className="template-variations__remove" onClick={() => setVariations((current) => current.filter((item) => item.id !== variation.id))}>
                Remover
              </button>
            </div>
            <textarea
              id={`variation-${variation.id}`}
              className="field__input broadcast-send__text"
              value={variation.text}
              onChange={(event) => updateVariation(variation.id, event.target.value)}
              maxLength={MAX_TEXT_LENGTH}
              rows={3}
            />
          </div>
        ))}
        <button type="button" className="template-variations__add" onClick={() => setVariations((current) => [...current, draftVariation('')])}>
          Adicionar variação
        </button>
      </div>

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
        ) : <p>Escreva um texto, uma variação ou adicione ao menos um anexo.</p>}
        {versionCount > 1 ? <p>{versionCount} versões de texto, uma por contato.</p> : null}
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
      initialVariations={template.data.variations}
      initialAudioAsVoice={template.data.audioAsVoice}
      initialFiles={template.data.files}
      onDone={onDone}
    />
  )
}
