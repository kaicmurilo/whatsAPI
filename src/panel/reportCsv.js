// CSV pensado para abrir direto no Excel em português:
// BOM UTF-8 (acentos), separador ";" (a vírgula é decimal no Brasil) e horário local.
const UTF8_BOM = '﻿'
const SEPARATOR = ';'
const LINE_BREAK = '\r\n'

const SITUATION_LABELS = {
  pending: 'Pendente',
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  failed: 'Falhou'
}

const HEADERS = [
  'Lista', 'Disparo em', 'Instância', 'Contato', 'Telefone', 'Situação',
  'Enviado em', 'Entregue em', 'Lido em', 'Reproduzido em', 'Erro'
]

const createDateFormatter = (timeZone) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  return (value) => (value ? formatter.format(new Date(value)).replace(',', '') : '')
}

// Telefone com espaço/parênteses: o Excel mantém como texto (só dígitos viraria 5,5E+12; com "+" viraria fórmula)
const formatPhoneForReport = (digits) => {
  const brazil = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits)
  if (brazil) return `55 (${brazil[1]}) ${brazil[2]}-${brazil[3]}`
  return `${digits.slice(0, 2)} ${digits.slice(2)}`
}

// Células começando com = + - @ viram fórmula no Excel (injeção via nome de contato) → prefixo apóstrofo
const neutralizeFormula = (value) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

const toCell = (value) => {
  const text = neutralizeFormula(value === null || value === undefined ? '' : String(value))
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toLine = (cells) => cells.map(toCell).join(SEPARATOR)

/**
 * @param {object} summary     disparo (listName, createdAt, sessionId)
 * @param {object[]} recipients destinatários com situation e horários
 * @param {string} timeZone     ex.: America/Sao_Paulo
 */
const buildReportCsv = (summary, recipients, timeZone) => {
  const formatDate = createDateFormatter(timeZone)
  const rows = recipients.map((recipient) => [
    summary.listName,
    formatDate(summary.createdAt),
    summary.sessionId,
    recipient.name,
    formatPhoneForReport(recipient.phone),
    SITUATION_LABELS[recipient.situation] ?? recipient.situation,
    formatDate(recipient.sentAt),
    formatDate(recipient.deliveredAt),
    formatDate(recipient.readAt),
    formatDate(recipient.playedAt),
    recipient.error
  ])
  return UTF8_BOM + [HEADERS, ...rows].map(toLine).join(LINE_BREAK) + LINE_BREAK
}

// "Promoção Setembro!" → "relatorio-promocao-setembro-12.csv"
const reportFileName = (summary) => {
  const slug = summary.listName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `relatorio-${slug || 'transmissao'}-${summary.id}.csv`
}

module.exports = { buildReportCsv, reportFileName }
