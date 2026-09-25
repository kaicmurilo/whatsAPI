const { normalizePhone } = require('./phone')

const BRAZIL_COUNTRY_CODE = '55'
const BR_NATIONAL_LENGTHS = [10, 11] // DDD + 8 (fixo/celular antigo) ou 9 dígitos
const BR_INTERNATIONAL_LENGTHS = [12, 13] // 55 + nacional
const TRUNK_PREFIX = '0' // "0 67 99999-9999" (discagem com operadora/tronco)
const PHONE_SEPARATORS = /[/,;|]| ou /i
const MAX_NAME_LENGTH = 100
const FALLBACK_NAME = 'Sem nome'

// "(67) 99999-9999" → "5567999999999"; null quando não dá para saber o número completo (ex.: sem DDD)
const toInternationalPhone = (raw) => {
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith(TRUNK_PREFIX) && BR_NATIONAL_LENGTHS.includes(digits.length - 1)) digits = digits.slice(1)
  if (BR_NATIONAL_LENGTHS.includes(digits.length)) return normalizePhone(BRAZIL_COUNTRY_CODE + digits)
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && BR_INTERNATIONAL_LENGTHS.includes(digits.length)) return normalizePhone(digits)
  return null
}

// Célula pode ter mais de um número: "(67) 9999-9999 / (67) 98888-8888"
const phonesFromCell = (cell) => {
  const parts = String(cell ?? '').split(PHONE_SEPARATORS).map((part) => part.trim()).filter(Boolean)
  const phones = parts.map(toInternationalPhone)
  return { phones: [...new Set(phones.filter(Boolean))], invalid: phones.filter((phone) => !phone).length }
}

const cleanName = (raw) => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) || FALLBACK_NAME

/**
 * Transforma linhas cruas da planilha no que será importado.
 * Cada número vira uma entrada (linha com 2 números → 2 contatos); número repetido no arquivo entra uma vez.
 * @param {{ name: string, phoneText: string }[]} rows
 * @returns {{ entries: { name: string, phone: string }[], skipped: { row: number, reason: string }[], duplicates: number }}
 */
const buildImportPlan = (rows) => {
  const seen = new Set()
  const entries = []
  const skipped = []
  let duplicates = 0
  rows.forEach((row, index) => {
    const rowNumber = index + 1
    const { phones, invalid } = phonesFromCell(row.phoneText)
    if (phones.length === 0) {
      skipped.push({ row: rowNumber, reason: String(row.phoneText ?? '').trim() ? 'Telefone inválido' : 'Sem telefone' })
      return
    }
    if (invalid > 0) skipped.push({ row: rowNumber, reason: `${invalid} número(s) inválido(s) ignorado(s) na célula` })
    for (const phone of phones) {
      if (seen.has(phone)) {
        duplicates++
        continue
      }
      seen.add(phone)
      entries.push({ name: cleanName(row.name), phone })
    }
  })
  return { entries, skipped, duplicates }
}

// "INTERIOR.xlsx" → "INTERIOR"
const listNameFromFile = (fileName) =>
  String(fileName ?? '').replace(/\.[^.]+$/, '').replace(/[\\/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH)

module.exports = { buildImportPlan, phonesFromCell, toInternationalPhone, listNameFromFile }
