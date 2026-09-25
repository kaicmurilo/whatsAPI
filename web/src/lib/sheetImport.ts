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

/**
 * Planilha (linhas × células) → { nome, texto do telefone }. Detecta as colunas pelo conteúdo, então aceita
 * o padrão "Nome | Cidade | (DD) 9XXXX-XXXX" com ou sem cabeçalho e em outra ordem de colunas.
 * A normalização do telefone (código do país, 2 números na célula) fica no servidor.
 */
export function extractImportRows(sheet: Cell[][]): ImportRow[] {
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
