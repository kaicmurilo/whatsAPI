const { zonedDayBounds } = require('./sendPolicy')

const DAY_MS = 24 * 60 * 60 * 1000
const PERIODS = ['today', 'yesterday', 'week', 'month', 'last30', 'all']
const DAILY_DAYS = 30

const dayKey = (date, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date)

const startOfZonedDay = (date, timeZone) => zonedDayBounds(date, timeZone).start

// Meio-dia local do dia deslocado, para o fuso com 23h ou 25h ainda cair no dia certo
const shiftZonedDays = (dayStart, timeZone, days) => {
  const probe = new Date(dayStart.getTime() + days * DAY_MS + 12 * 60 * 60 * 1000)
  return startOfZonedDay(probe, timeZone)
}

const startOfZonedMonth = (now, timeZone) => {
  let cursor = startOfZonedDay(now, timeZone)
  while (!dayKey(cursor, timeZone).endsWith('-01')) {
    cursor = shiftZonedDays(cursor, timeZone, -1)
  }
  return cursor
}

// Janelas [início, fim) no fuso do relatório. "all" não tem limite.
const metricWindows = (now, timeZone) => {
  const today = zonedDayBounds(now, timeZone)
  return {
    today: { start: today.start, end: today.end },
    yesterday: { start: shiftZonedDays(today.start, timeZone, -1), end: today.start },
    week: { start: shiftZonedDays(today.start, timeZone, -6), end: today.end },
    month: { start: startOfZonedMonth(now, timeZone), end: today.end },
    last30: { start: shiftZonedDays(today.start, timeZone, -(DAILY_DAYS - 1)), end: today.end },
    all: { start: null, end: null }
  }
}

const listDayKeys = (now, timeZone, days = DAILY_DAYS) => {
  const today = startOfZonedDay(now, timeZone)
  const keys = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(dayKey(shiftZonedDays(today, timeZone, -offset), timeZone))
  }
  return keys
}

module.exports = { PERIODS, DAILY_DAYS, dayKey, metricWindows, listDayKeys }
