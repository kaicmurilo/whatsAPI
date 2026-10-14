jest.mock('../database', () => ({ query: jest.fn() }))

const { query } = require('../database')
const { loadOutgoingMetrics, loadIntegrationSummary } = require('./metricsRepository')
const { mergeOutgoing, mergeIntegrationSummary } = require('./metricsController')
const { PERIODS, metricWindows } = require('./metricsRanges')

const countsFor = (value) => Object.fromEntries(PERIODS.map((period) => [period, value]))
const emptyPeriods = () => Object.fromEntries(PERIODS.map((period) => [period, { sent: 0 }]))

describe('outgoing messages in the dashboard', () => {
  beforeEach(() => query.mockReset())

  test('counts only integration sends from the user own instances, split by group', async () => {
    query.mockResolvedValueOnce({ rows: [{ sessionId: 'loja-centro-01', isGroup: true, ...countsFor('3') }] })
    const outgoing = await loadOutgoingMetrics('user-1', metricWindows(new Date('2026-10-13T15:00:00Z'), 'America/Sao_Paulo'))
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/FROM api_sent_messages/)
    expect(sql).not.toMatch(/whatsapp_messages/)
    expect(sql).toMatch(/s\.user_id = \$1/)
    expect(sql).toMatch(/is_group/)
    expect(params[0]).toBe('user-1')
    expect(outgoing).toEqual([{ sessionId: 'loja-centro-01', isGroup: true, periods: countsFor(3) }])
  })

  test('splits totals and instances into groups and contacts, zero when nothing was sent', () => {
    const periods = emptyPeriods()
    const instances = [
      { sessionId: 'loja-centro-01', periods: emptyPeriods() },
      { sessionId: 'loja-norte-022', periods: emptyPeriods() }
    ]
    mergeOutgoing(periods, instances, [
      { sessionId: 'loja-centro-01', isGroup: true, periods: countsFor(2) },
      { sessionId: 'loja-centro-01', isGroup: false, periods: countsFor(1) },
      { sessionId: 'loja-sul-00003', isGroup: false, periods: countsFor(5) }
    ])
    expect(periods.today).toMatchObject({ outgoing: 8, outgoingGroups: 2, outgoingContacts: 6 })
    expect(instances[0].periods.today).toMatchObject({ outgoing: 3, outgoingGroups: 2, outgoingContacts: 1 })
    expect(instances[1].periods.today).toMatchObject({ outgoing: 0, outgoingGroups: 0, outgoingContacts: 0 })
  })

  test('integration summary: batches, saved sends and distinct chats per period, merged into the bucket', async () => {
    const row = Object.fromEntries(PERIODS.flatMap((period) => [
      [`batches_${period}`, 2], [`batchedTexts_${period}`, 7], [`savedSends_${period}`, 5],
      [`distinctGroups_${period}`, 1], [`distinctContacts_${period}`, 3]
    ]))
    query.mockResolvedValueOnce({ rows: [row] })
    const summary = await loadIntegrationSummary('user-1', metricWindows(new Date('2026-10-14T15:00:00Z'), 'America/Sao_Paulo'))
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/SUM\(a\.batch_size - 1\)/)
    expect(sql).toMatch(/COUNT\(DISTINCT a\.chat_id\) FILTER \(WHERE a\.is_group/)
    expect(params[0]).toBe('user-1')
    expect(summary.today).toEqual({ batches: 2, batchedTexts: 7, savedSends: 5, distinctGroups: 1, distinctContacts: 3 })
    const periods = emptyPeriods()
    mergeIntegrationSummary(periods, summary)
    expect(periods.month).toMatchObject({ sent: 0, savedSends: 5, distinctContacts: 3 })
  })
})
