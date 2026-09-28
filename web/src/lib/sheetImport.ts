import type { ImportRow } from '../types/api'

type Cell = string | number | boolean | Date | null | undefined

const MIN_PHONE_DIGITS = 8
const MAX_CELL_LENGTH = 300

const cellText = (cell: Cell): string => (cell === null || cell === undefined ? '' : String(cell)).trim().slice(0, MAX_CELL_LENGTH)
const looksLikePhone = (cell: Cell): boolean => cellText(cell).replace(/\D/g, '').length >= MIN_PHONE_DIGITS
const looksLikeName = (cell: Cell): boolean => /\p{L}/u.test(cellText(cell)) && !looksLikePhone(cell)

const columnCount = (rows: Cell[][]): number => rows.reduce((max, row) => Math.max(max, row.length), 0)

// Coluna com mais células "com cara" do critério (telefone ou nome)
function bestColumn(rows: Cell[][], matches: (cell: Cell) => boolean, exclude: number | null): number | null {
  let best: number | null = null
  let bestScore = 0
  for (let column = 0; column < columnCount(rows); column++) {
    if (column === exclude) continue
    const score = rows.filter((row) => matches(row[column])).length
    if (score > bestScore) {
      best = column
      bestScore = score
    }
  }
  return best
}

const headerName = (cell: Cell): string => cellText(cell).toLowerCase().replace(/\s+/g, '_')

const columnIndex = (header: string[], name: string): number => header.indexOf(name)

// Exportação de contatos (country_code, phone_number, saved_name, public_name, …).
// O telefone já inclui o DDI; o "+" avisa o servidor para não tratar como número nacional do Brasil.
// Nome: o salvo na agenda, e o nome público do WhatsApp quando o salvo está vazio.
function extractContactExport(sheet: Cell[][]): ImportRow[] | null {
  if (sheet.length === 0) return null
  const header = sheet[0].map(headerName)
  const phoneIndex = columnIndex(header, 'phone_number')
  if (phoneIndex === -1 || columnIndex(header, 'country_code') === -1) return null
  const savedIndex = columnIndex(header, 'saved_name')
  const publicIndex = columnIndex(header, 'public_name')
  return sheet
    .slice(1)
    .filter((row) => row.some((cell) => cellText(cell) !== ''))
    .map((row) => {
      const saved = savedIndex === -1 ? '' : cellText(row[savedIndex])
      const published = publicIndex === -1 ? '' : cellText(row[publicIndex])
      const digits = cellText(row[phoneIndex]).replace(/\D/g, '')
      return { name: saved || published, phoneText: digits ? `+${digits}` : '' }
    })
}

/**
 * Planilha (linhas × células) → { nome, texto do telefone }.
 * Aceita a exportação de contatos (phone_number + country_code) e, no mais, detecta as colunas pelo conteúdo:
 * "Nome | Cidade | (DD) 9XXXX-XXXX", com ou sem cabeçalho e em outra ordem.
 * A normalização do telefone (código do país, 2 números na célula) fica no servidor.
 */
export function extractImportRows(sheet: Cell[][]): ImportRow[] {
  const exported = extractContactExport(sheet)
  if (exported) return exported
  const phoneColumn = bestColumn(sheet, looksLikePhone, null)
  if (phoneColumn === null) return []
  const nameColumn = bestColumn(sheet, looksLikeName, phoneColumn)
  const hasHeader = sheet.length > 0 && !looksLikePhone(sheet[0][phoneColumn])
  return sheet
    .slice(hasHeader ? 1 : 0)
    .filter((row) => row.some((cell) => cellText(cell) !== ''))
    .map((row) => ({ name: nameColumn === null ? '' : cellText(row[nameColumn]), phoneText: cellText(row[phoneColumn]) }))
}

// Biblioteca carregada só quando alguém importa (não pesa no carregamento do painel)
export async function readSpreadsheet(file: File): Promise<Cell[][]> {
  const { readSheet } = await import('read-excel-file/browser')
  return (await readSheet(file)) as Cell[][]
}
