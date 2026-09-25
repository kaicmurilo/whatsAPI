const MINUTE_MS = 60 * 1000
const MIN_LEAD_MINUTES = 2
const pad = (value: number) => String(value).padStart(2, '0')

// Date → valor do <input type="datetime-local"> no fuso do navegador ("2026-09-25T09:30")
export const toLocalInputValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`

export const earliestScheduleValue = (now = new Date()): string => toLocalInputValue(new Date(now.getTime() + MIN_LEAD_MINUTES * MINUTE_MS))

// Valor local do input → ISO com fuso (o servidor guarda o instante exato)
export const localInputToIso = (value: string): string | null => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const isValidScheduleValue = (value: string, now = new Date()): boolean => {
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime() + MINUTE_MS
}

const scheduleFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const formatSchedule = (value: string | Date): string => scheduleFormatter.format(new Date(value)).replace(',', ' às')
