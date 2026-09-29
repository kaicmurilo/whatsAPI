const DAILY_CAP_MIN = 20
const DAILY_CAP_MAX = 400
const DAILY_CAP_DEFAULT = 80
const QUIET_START_DEFAULT = '08:00'
const QUIET_END_DEFAULT = '20:00'
const MAX_KEYWORDS = 10
const MAX_KEYWORD_LENGTH = 32
const UNNAMED = new Set(['sem nome'])
const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const placeholderPattern = () => /\{nome\}/gi

const QUIET_PAUSE_ERROR = 'Pausado: fora do horário de envio. Retoma sozinho quando a janela abrir.'
const CAP_PAUSE_ERROR = 'Pausado: teto diário da instância atingido. Retoma sozinho quando houver cota.'

const fold = (value) => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Mensagem inteira, sem diferenciar acento ou maiúscula. "não quero sair" não casa.
const suppressionToken = (body) => {
  if (typeof body !== 'string') return null
  const compact = fold(body).trim().replace(/[!?.…,;:]+$/u, '').trim()
  if (!compact || /\s/u.test(compact)) return null
  return compact
}

const matchedKeyword = (body, keywords) => {
  const token = suppressionToken(body)
  if (!token || !Array.isArray(keywords)) return null
  for (const keyword of keywords) {
    if (typeof keyword === 'string' && suppressionToken(keyword) === token) return keyword
  }
  return null
}

const firstNameOf = (name) => {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed || UNNAMED.has(fold(trimmed))) return null
  const first = trimmed.split(/\s+/)[0].replace(/[,.]+$/u, '')
  if (!first || UNNAMED.has(fold(first))) return null
  return first
}

const collapseText = (text) => text
  .replace(placeholderPattern(), '')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\s+([,!.?;:])/g, '$1')
  .replace(/^[,\s]+/g, '')
  .replace(/\s+$/g, '')
  .trim()

const applyFirstName = (text, firstName) => {
  if (typeof text !== 'string' || text.length === 0) return text
  const hasPlaceholder = placeholderPattern().test(text)
  if (!firstName) return hasPlaceholder ? collapseText(text) : text
  if (hasPlaceholder) return collapseText(text.replace(placeholderPattern(), firstName))
  const head = fold(text).slice(0, 80)
  if (head.includes(fold(firstName))) return text
  return `${firstName}, ${text}`
}

// Só a primeira parte com texto (mensagem ou legenda). Sem nome, tira {nome}. Sem texto, não cria bolha.
const applyFirstNameToParts = (parts, contactName) => {
  const firstName = firstNameOf(contactName)
  let applied = false
  const next = parts.map((part) => {
    if (applied) return part
    if (part.kind === 'text' && typeof part.text === 'string' && part.text.length > 0) {
      applied = true
      return { ...part, text: applyFirstName(part.text, firstName) }
    }
    const caption = part.kind === 'media' ? part.options?.caption : undefined
    if (typeof caption === 'string' && caption.length > 0) {
      applied = true
      return { ...part, options: { ...part.options, caption: applyFirstName(caption, firstName) } }
    }
    return part
  })
  return next.filter((part) => part.kind !== 'text' || (typeof part.text === 'string' && part.text.trim().length > 0))
}

const clockToMinutes = (value) => {
  const match = CLOCK_PATTERN.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

const zonedClock = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour').value)
  const minute = Number(parts.find((part) => part.type === 'minute').value)
  return hour * 60 + minute
}

const dayKey = (date, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date)

// Janela em que o envio é permitido. 08:00–20:00 inclui 08:00 e exclui 20:00. start > end cruza a meia-noite.
const isInsideSendWindow = (date, { quietStart, quietEnd }, timeZone) => {
  const start = clockToMinutes(quietStart)
  const end = clockToMinutes(quietEnd)
  if (start === null || end === null || start === end) return true
  const minutes = zonedClock(date, timeZone)
  if (start < end) return minutes >= start && minutes < end
  return minutes >= start || minutes < end
}

const findInstant = (low, high, accept) => {
  let start = low
  let end = high
  while (end - start > 1) {
    const mid = Math.floor((start + end) / 2)
    if (accept(mid)) end = mid
    else start = mid
  }
  return new Date(end)
}

// Meia-noite local → instante UTC, sem depender de horário de verão fixo
const zonedDayBounds = (date, timeZone) => {
  const key = dayKey(date, timeZone)
  const start = findInstant(date.getTime() - 36 * 60 * 60 * 1000, date.getTime(), (instant) => dayKey(new Date(instant), timeZone) === key)
  const end = findInstant(start.getTime() + 20 * 60 * 60 * 1000, start.getTime() + 30 * 60 * 60 * 1000, (instant) => dayKey(new Date(instant), timeZone) !== key)
  return { start, end }
}

const sessionsOverCap = (sessionIds, sentToday, cap) => {
  const blocked = new Set()
  for (const sessionId of sessionIds) {
    if ((sentToday.get(sessionId) ?? 0) >= cap) blocked.add(sessionId)
  }
  return blocked
}

const canResumePolicy = ({ settings, now, timeZone, sessionIds, sentToday }) => {
  if (settings.quietHoursEnabled && !isInsideSendWindow(now, settings, timeZone)) return false
  if (!settings.dailyCapEnabled) return true
  return sessionIds.some((sessionId) => (sentToday.get(sessionId) ?? 0) < settings.dailyCap)
}

const parseClock = (value) => (typeof value === 'string' && CLOCK_PATTERN.test(value) ? value : null)

const parseKeywordList = (value) => {
  if (!Array.isArray(value)) return { error: 'Informe as palavras de supressão' }
  if (value.length > MAX_KEYWORDS) return { error: `No máximo ${MAX_KEYWORDS} palavras de supressão` }
  const keywords = []
  const seen = new Set()
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'Cada palavra de supressão é um texto' }
    const trimmed = item.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_KEYWORD_LENGTH) return { error: `Palavra de supressão com até ${MAX_KEYWORD_LENGTH} caracteres` }
    const token = suppressionToken(trimmed)
    if (!token || token !== fold(trimmed)) return { error: 'Cada palavra de supressão é um único termo, sem espaço' }
    if (seen.has(token)) continue
    seen.add(token)
    keywords.push(trimmed)
  }
  return { keywords }
}

const parseBool = (value, label) => (typeof value === 'boolean' ? { value } : { error: `${label} precisa ser verdadeiro ou falso` })

/**
 * Corpo do PUT de configuração. Whitelist: campo desconhecido é ignorado.
 * @returns {{ settings?: object, error?: string }}
 */
const parseSettingsInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Corpo inválido' }
  const suppressionEnabled = parseBool(body.suppressionEnabled, 'Supressão')
  if (suppressionEnabled.error) return suppressionEnabled
  const stopOnReply = parseBool(body.stopOnReply, 'Parar quem respondeu')
  if (stopOnReply.error) return stopOnReply
  const prependFirstName = parseBool(body.prependFirstName, 'Nome no início')
  if (prependFirstName.error) return prependFirstName
  const dailyCapEnabled = parseBool(body.dailyCapEnabled, 'Teto diário')
  if (dailyCapEnabled.error) return dailyCapEnabled
  const quietHoursEnabled = parseBool(body.quietHoursEnabled, 'Horário de envio')
  if (quietHoursEnabled.error) return quietHoursEnabled
  const parsedKeywords = parseKeywordList(body.suppressionKeywords)
  if (parsedKeywords.error) return parsedKeywords
  if (suppressionEnabled.value && parsedKeywords.keywords.length === 0) {
    return { error: 'Informe ao menos uma palavra de supressão' }
  }
  const dailyCap = Number(body.dailyCap)
  if (!Number.isInteger(dailyCap) || dailyCap < DAILY_CAP_MIN || dailyCap > DAILY_CAP_MAX) {
    return { error: `Teto diário entre ${DAILY_CAP_MIN} e ${DAILY_CAP_MAX} mensagens` }
  }
  const quietStart = parseClock(body.quietStart)
  const quietEnd = parseClock(body.quietEnd)
  if (!quietStart || !quietEnd) return { error: 'Horário inválido: use HH:MM' }
  if (quietStart === quietEnd) return { error: 'O horário inicial e o final não podem ser iguais' }
  return {
    settings: {
      suppressionEnabled: suppressionEnabled.value,
      suppressionKeywords: parsedKeywords.keywords,
      stopOnReply: stopOnReply.value,
      prependFirstName: prependFirstName.value,
      dailyCapEnabled: dailyCapEnabled.value,
      dailyCap,
      quietHoursEnabled: quietHoursEnabled.value,
      quietStart,
      quietEnd
    }
  }
}

module.exports = {
  DAILY_CAP_MIN,
  DAILY_CAP_MAX,
  DAILY_CAP_DEFAULT,
  QUIET_START_DEFAULT,
  QUIET_END_DEFAULT,
  QUIET_PAUSE_ERROR,
  CAP_PAUSE_ERROR,
  fold,
  suppressionToken,
  matchedKeyword,
  firstNameOf,
  applyFirstName,
  applyFirstNameToParts,
  isInsideSendWindow,
  zonedDayBounds,
  sessionsOverCap,
  canResumePolicy,
  parseSettingsInput
}
