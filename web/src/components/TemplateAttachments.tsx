import { fileKindLabel, formatBytes } from '../lib/format'
import { toTemplateFile } from '../lib/templatePreview'
import type { TemplateFile } from '../types/api'
import type { TemplateAttachmentsProps } from '../types/components'
import { FilePicker } from './FilePicker'

const MAX_ATTACHMENTS = 10

const move = (files: TemplateFile[], from: number, to: number): TemplateFile[] => {
  const next = [...files]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// Anexos em ordem de envio: adicionar (biblioteca ou upload), subir/descer, remover
export function TemplateAttachments({ files, onChange }: TemplateAttachmentsProps) {
  const add = (file: TemplateFile | null) => {
    if (!file || files.some((existing) => existing.id === file.id)) return
    onChange([...files, toTemplateFile(file)])
  }

  return (
    <div className="template-attachments">
      <span className="field__label">Anexos ({files.length}/{MAX_ATTACHMENTS}) — enviados nesta ordem</span>
      {files.length > 0 ? (
        <ol className="template-attachments__list">
          {files.map((file, index) => (
            <li key={file.id} className="template-attachments__item">
              <span className="file-chip__kind">{fileKindLabel(file.mimetype)}</span>
              <span className="template-attachments__name">{file.name}</span>
              <span className="file-chip__size">{formatBytes(file.sizeBytes)}</span>
              <span className="template-attachments__controls">
                <button type="button" onClick={() => onChange(move(files, index, index - 1))} disabled={index === 0} aria-label={`Subir ${file.name}`}>↑</button>
                <button type="button" onClick={() => onChange(move(files, index, index + 1))} disabled={index === files.length - 1} aria-label={`Descer ${file.name}`}>↓</button>
                <button type="button" onClick={() => onChange(files.filter((existing) => existing.id !== file.id))} aria-label={`Remover ${file.name}`}>×</button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {files.length < MAX_ATTACHMENTS ? <FilePicker selectedFile={null} onChange={add} /> : null}
    </div>
  )
}
