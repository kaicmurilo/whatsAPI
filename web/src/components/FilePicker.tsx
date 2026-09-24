import { useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFiles } from '../hooks/useFiles'
import { fileKindLabel, formatBytes } from '../lib/format'
import type { PanelFile } from '../types/api'
import type { FilePickerProps } from '../types/components'
import { FileUploadButton } from './FileUploadButton'

const PICKER_PAGE_SIZE = 8
const SEARCH_DEBOUNCE_MS = 250

function SelectedFileChip({ file, onClear, isDisabled }: { file: PanelFile; onClear: () => void; isDisabled: boolean }) {
  return (
    <span className="file-chip">
      <span className="file-chip__kind">{fileKindLabel(file.mimetype)}</span>
      <span className="file-chip__name">{file.name}</span>
      <span className="file-chip__size">{formatBytes(file.sizeBytes)}</span>
      <button type="button" className="file-chip__clear" onClick={onClear} disabled={isDisabled} aria-label="Remover anexo">×</button>
    </span>
  )
}

// Escolhe um arquivo da biblioteca (ou envia um novo, que já fica salvo para as próximas vezes)
export function FilePicker({ selectedFile, onChange, isDisabled = false }: FilePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const files = useFiles({ page: 1, search: debouncedSearch }, PICKER_PAGE_SIZE)

  const choose = (file: PanelFile) => {
    onChange(file)
    setIsOpen(false)
    setSearch('')
  }

  if (selectedFile) return <SelectedFileChip file={selectedFile} onClear={() => onChange(null)} isDisabled={isDisabled} />

  return (
    <div className="file-picker">
      <button type="button" className="file-picker__toggle" aria-expanded={isOpen} disabled={isDisabled} onClick={() => setIsOpen((open) => !open)}>
        📎 Anexar
      </button>
      {isOpen ? (
        <div className="file-picker__panel" role="dialog" aria-label="Escolher arquivo">
          <div className="file-picker__head">
            <input
              className="file-picker__search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar na biblioteca"
              aria-label="Buscar arquivo"
              autoFocus
            />
            <FileUploadButton label="Novo" className="file-picker__upload" onUploaded={choose} />
          </div>
          <ul className="file-picker__list">
            {(files.data?.items ?? []).map((file) => (
              <li key={file.id}>
                <button type="button" className="file-picker__item" onClick={() => choose(file)}>
                  <span className="file-picker__name">{file.name}</span>
                  <span className="file-picker__meta">{fileKindLabel(file.mimetype)} · {formatBytes(file.sizeBytes)}</span>
                </button>
              </li>
            ))}
          </ul>
          {files.isSuccess && files.data.items.length === 0 ? <p className="file-picker__empty">Nenhum arquivo. Use “Novo” para enviar.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
