const { dayKey, metricWindows, listDayKeys } = require('./metricsRanges')

const zone = 'America/Sao_Paulo'
// 29 set 2026, 13:00 em São Paulo (UTC-3)
const now = new Date('2026-09-29T16:00:00.000Z')

describe('metric windows', () => {
  test('today, yesterday, week and month follow the report timezone', () => {
    const windows = metricWindows(now, zone)
    expect(dayKey(windows.today.start, zone)).toBe('2026-09-29')
    expect(windows.today.end.toISOString()).toBe(metricWindows(new Date(windows.today.end.getTime() + 60 * 1000), zone).today.start.toISOString())
    expect(dayKey(windows.yesterday.start, zone)).toBe('2026-09-28')
    expect(windows.yesterday.end.toISOString()).toBe(windows.today.start.toISOString())
    expect(dayKey(windows.week.start, zone)).toBe('2026-09-23')
    expect(dayKey(windows.month.start, zone)).toBe('2026-09-01')
    expect(dayKey(windows.last30.start, zone)).toBe('2026-08-31')
    expect(windows.all.start).toBeNull()
  })

  test('lists the last 30 local days ending today', () => {
    const keys = listDayKeys(now, zone)
    expect(keys).toHaveLength(30)
    expect(keys[0]).toBe('2026-08-31')
    expect(keys[keys.length - 1]).toBe('2026-09-29')
  })
})
