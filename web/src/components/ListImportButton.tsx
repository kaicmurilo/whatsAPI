import { useRef, useState, type ChangeEvent } from 'react'
import { useImportBroadcastList } from '../hooks/useBroadcasts'
import { extractImportRows, readSpreadsheet } from '../lib/sheetImport'
import type { ListImportResult } from '../types/api'

const SKIPPED_PREVIEW = 5

function describeResult(result: ListImportResult): string {
  const parts = [
    `Lista "${result.list.name}" criada com ${result.list.memberCount} contato(s)`,
    `${result.createdContacts} novo(s) na agenda`,
    `${result.reusedContacts} já existia(m)`,
  ]
  if (result.duplicates > 0) parts.push(`${result.duplicates} número(s) repetido(s) no arquivo`)
  return `${parts.join(' · ')}.`
}

// Lê a planilha no navegador e manda só as linhas em texto; o servidor normaliza e cria a lista
export function ListImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const importList = useImportBroadcastList()

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // permite importar o mesmo arquivo de novo
    if (!file) return
    setReadError(null)
    importList.reset()
    setIsReading(true)
    try {
      const rows = extractImportRows(await readSpreadsheet(file))
      if (rows.length === 0) {
        setReadError('Não encontrei uma coluna de telefones nessa planilha.')
        return
      }
      importList.mutate({ fileName: file.name, rows })
    } catch {
      setReadError('Não consegui ler o arquivo. Envie uma planilha .xlsx.')
    } finally {
      setIsReading(false)
    }
  }

  const isBusy = isReading || importList.isPending
  const skipped = importList.data?.skipped ?? []

  return (
    <div className="list-import">
      <input ref={inputRef} type="file" accept=".xlsx" className="visually-hidden" onChange={handleFile} tabIndex={-1} aria-hidden="true" />
      <button type="button" className="broadcasts__new" disabled={isBusy} onClick={() => inputRef.current?.click()}>
        {isReading ? 'Lendo planilha…' : importList.isPending ? 'Importando…' : '⇪ Importar planilha'}
      </button>
      {readError ? <p className="list-import__error" role="alert">{readError}</p> : null}
      {importList.isError ? <p className="list-import__error" role="alert">{importList.error.message}</p> : null}
      {importList.data ? (
        <div className="list-import__result" role="status">
          <p>{describeResult(importList.data)}</p>
          {skipped.length > 0 ? (
            <details>
              <summary>{skipped.length} linha(s) com problema</summary>
              <ul>
                {skipped.slice(0, SKIPPED_PREVIEW).map((item) => <li key={item.row}>Linha {item.row}: {item.reason}</li>)}
                {skipped.length > SKIPPED_PREVIEW ? <li>… e mais {skipped.length - SKIPPED_PREVIEW}</li> : null}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
