import { useRef, type ChangeEvent } from 'react'
import { useUploadFile } from '../hooks/useFiles'
import type { FileUploadButtonProps } from '../types/components'

// Botão que abre o seletor nativo e já salva na biblioteca; devolve o arquivo salvo para quem chamou
export function FileUploadButton({ label = 'Enviar arquivo', onUploaded, className }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadFile = useUploadFile()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    uploadFile.mutate(file, { onSuccess: (saved) => onUploaded?.(saved) })
  }

  return (
    <span className="file-upload">
      <input ref={inputRef} type="file" className="visually-hidden" onChange={handleChange} tabIndex={-1} aria-hidden="true" />
      <button type="button" className={className ?? 'file-upload__button'} disabled={uploadFile.isPending} onClick={() => inputRef.current?.click()}>
        {uploadFile.isPending ? 'Enviando…' : label}
      </button>
      {uploadFile.isError ? <span className="file-upload__error" role="alert">{uploadFile.error.message}</span> : null}
    </span>
  )
}
