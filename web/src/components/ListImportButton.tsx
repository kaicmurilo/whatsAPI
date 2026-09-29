import { useRef, useState, type ChangeEvent } from 'react'
import { useImportBroadcastList } from '../hooks/useBroadcasts'
import { formatBytes } from '../lib/format'
import { extractImportRows, readSpreadsheet } from '../lib/sheetImport'
import type { ListImportResult } from '../types/api'

const SKIPPED_PREVIEW = 5
const READ_TIMEOUT_MS = 30_000

function describeResult(result: ListImportResult): string {
  const parts = [
    `Lista "${result.list.name}" criada com ${result.list.memberCount} contato(s)`,
    `${result.createdContacts} novo(s) na agenda`,
    `${result.reusedContacts} já existia(m)`,
  ]
  if (result.duplicates > 0) parts.push(`${result.duplicates} número(s) repetido(s) no arquivo`)
  return `${parts.join(' · ')}.`
}

const appendLine = (lines: string[], line: string): string[] => (lines.at(-1) === line ? lines : [...lines, line])

// Lê a planilha no navegador e manda só as linhas em texto; o servidor normaliza e cria a lista
export function ListImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const attemptRef = useRef(0)
  const [readError, setReadError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const importList = useImportBroadcastList()
  const visibleLog = importList.isSuccess ? appendLine(log, 'Importação concluída.') : log

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // permite importar o mesmo arquivo de novo
    if (!file) return
    const attempt = attemptRef.current + 1
    attemptRef.current = attempt
    const still = () => attemptRef.current === attempt
    setReadError(null)
    importList.reset()
    setLog([`Lendo ${file.name} (${formatBytes(file.size)}).`])
    setIsReading(true)
    const timer = window.setTimeout(() => {
      if (!still()) return
      attemptRef.current += 1
      setIsReading(false)
      setReadError('A leitura passou de 30 segundos e foi cancelada. Você já pode importar outra planilha.')
    }, READ_TIMEOUT_MS)
    try {
      const rows = extractImportRows(await readSpreadsheet(file))
      if (!still()) return
      if (rows.length === 0) {
        setReadError('Não encontrei uma coluna de telefones nessa planilha.')
        return
      }
      setLog((lines) => appendLine(lines, `${rows.length} linha(s) lidas. Enviando ao servidor…`))
      importList.mutate({ fileName: file.name, rows })
    } catch (error) {
      if (!still()) return
      const detail = error instanceof Error && error.message ? ` ${error.message}` : ''
      setReadError(`Não consegui ler o arquivo. Envie uma planilha .xlsx.${detail}`)
    } finally {
      window.clearTimeout(timer)
      if (still()) setIsReading(false)
    }
  }

  const isBusy = isReading || importList.isPending
  const skipped = importList.data?.skipped ?? []
  const serverError = importList.isError ? importList.error.message : null

  return (
    <div className="list-import">
      <input ref={inputRef} type="file" accept=".xlsx" className="visually-hidden" onChange={handleFile} tabIndex={-1} aria-hidden="true" />
      <button type="button" className="broadcasts__new" disabled={isBusy} onClick={() => inputRef.current?.click()}>
        {isReading ? 'Lendo planilha…' : importList.isPending ? 'Importando…' : '⇪ Importar planilha'}
      </button>
      {visibleLog.length > 0 ? (
        <ol className="list-import__log" aria-live="polite">
          {visibleLog.map((line) => <li key={line}>{line}</li>)}
        </ol>
      ) : null}
      {readError || serverError ? <p className="list-import__error" role="alert">{readError ?? serverError}</p> : null}
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
