jest.mock('../database', () => ({ query: jest.fn() }))

const { query } = require('../database')
const { loadOutgoingMetrics } = require('./metricsRepository')
const { mergeOutgoing } = require('./metricsController')
const { PERIODS, metricWindows } = require('./metricsRanges')

const countsFor = (value) => Object.fromEntries(PERIODS.map((period) => [period, value]))

describe('outgoing messages in the dashboard', () => {
  beforeEach(() => query.mockReset())

  test('counts only messages sent from the user own instances', async () => {
    query.mockResolvedValueOnce({ rows: [{ sessionId: 'loja-centro-01', ...countsFor('3') }] })
    const outgoing = await loadOutgoingMetrics('user-1', metricWindows(new Date('2026-10-13T15:00:00Z'), 'America/Sao_Paulo'))
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/m\.from_me/)
    expect(sql).toMatch(/s\.user_id = \$1/)
    expect(params[0]).toBe('user-1')
    expect(outgoing).toEqual([{ sessionId: 'loja-centro-01', periods: countsFor(3) }])
  })

  test('sums instances into the totals and fills instances without messages with zero', () => {
    const periods = Object.fromEntries(PERIODS.map((period) => [period, { sent: 0 }]))
    const instances = [
      { sessionId: 'loja-centro-01', periods: Object.fromEntries(PERIODS.map((period) => [period, { sent: 0 }])) },
      { sessionId: 'loja-norte-022', periods: Object.fromEntries(PERIODS.map((period) => [period, { sent: 0 }])) }
    ]
    mergeOutgoing(periods, instances, [
      { sessionId: 'loja-centro-01', periods: countsFor(2) },
      { sessionId: 'loja-sul-00003', periods: countsFor(5) }
    ])
    expect(periods.today.outgoing).toBe(7)
    expect(instances[0].periods.today.outgoing).toBe(2)
    expect(instances[1].periods.today.outgoing).toBe(0)
  })
})
