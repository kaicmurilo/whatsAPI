jest.mock('../database', () => ({ query: jest.fn() }))

const { query } = require('../database')
const { loadOutgoingMetrics } = require('./metricsRepository')
const { mergeOutgoing } = require('./metricsController')
const { PERIODS, metricWindows } = require('./metricsRanges')

const countsFor = (value) => Object.fromEntries(PERIODS.map((period) => [period, value]))
const emptyPeriods = () => Object.fromEntries(PERIODS.map((period) => [period, { sent: 0 }]))

describe('outgoing messages in the dashboard', () => {
  beforeEach(() => query.mockReset())

  test('counts only messages sent from the user own instances, split by group', async () => {
    query.mockResolvedValueOnce({ rows: [{ sessionId: 'loja-centro-01', isGroup: true, ...countsFor('3') }] })
    const outgoing = await loadOutgoingMetrics('user-1', metricWindows(new Date('2026-10-13T15:00:00Z'), 'America/Sao_Paulo'))
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/m\.from_me/)
    expect(sql).toMatch(/s\.user_id = \$1/)
    expect(sql).toMatch(/@g\.us/)
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
})
