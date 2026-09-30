const { pickByDailyLoad, runBroadcast } = require('./broadcastRunner')

const sessions = ['inst-a', 'inst-b', 'inst-c']
const clients = (online) => (sessionId) => (online.has(sessionId) ? { sessionId } : null)
const online = clients(new Set(sessions))

const loadOf = (rows) => new Map(rows.map((row) => [row.sessionId, { today: row.today, lastSentAt: row.lastSentAt }]))

describe('daily send balance', () => {
  test('picks the instance with fewer sends today', () => {
    const load = loadOf([
      { sessionId: 'inst-a', today: 4, lastSentAt: '2026-09-30T10:00:00.000Z' },
      { sessionId: 'inst-b', today: 1, lastSentAt: '2026-09-30T12:00:00.000Z' },
      { sessionId: 'inst-c', today: 3, lastSentAt: '2026-09-30T09:00:00.000Z' }
    ])
    expect(pickByDailyLoad(sessions, new Set(), online, load).sessionId).toBe('inst-b')
  })

  test('on a tie, picks the instance whose last send is older', () => {
    const load = loadOf([
      { sessionId: 'inst-a', today: 2, lastSentAt: '2026-09-30T15:00:00.000Z' },
      { sessionId: 'inst-b', today: 2, lastSentAt: '2026-09-30T11:00:00.000Z' },
      { sessionId: 'inst-c', today: 5, lastSentAt: '2026-09-29T08:00:00.000Z' }
    ])
    expect(pickByDailyLoad(sessions, new Set(), online, load).sessionId).toBe('inst-b')
  })

  test('an instance that never sent wins a zero tie', () => {
    const load = loadOf([
      { sessionId: 'inst-a', today: 0, lastSentAt: '2026-09-29T18:00:00.000Z' }
    ])
    expect(pickByDailyLoad(sessions, new Set(), online, load).sessionId).toBe('inst-b')
  })

  test('skips offline and excluded instances', () => {
    const getClient = clients(new Set(['inst-a', 'inst-c']))
    const load = loadOf([
      { sessionId: 'inst-a', today: 0, lastSentAt: null },
      { sessionId: 'inst-c', today: 9, lastSentAt: '2026-09-30T16:00:00.000Z' }
    ])
    expect(pickByDailyLoad(sessions, new Set(['inst-a']), getClient, load).sessionId).toBe('inst-c')
    expect(pickByDailyLoad(sessions, new Set(sessions), online, load)).toBeNull()
  })
})

describe('send queue release', () => {
  test('frees the global slot when the database times out', async () => {
    let held = 0
    const releaseSlot = jest.fn(() => { held -= 1 })
    const run = {
      id: '9',
      recipients: [{ position: 0, phone: '5511999999999', name: 'Ana' }],
      parts: [{ kind: 'text', text: 'oi' }],
      pacing: { minSeconds: 1, maxSeconds: 1, randomOrder: false },
      sessionIds: ['inst-a'],
      signal: new AbortController().signal
    }
    const gate = {
      ready: async () => {},
      pauseForWindow: async () => null,
      classify: async () => null,
      sessionsOverCap: async () => new Set(),
      sendLoad: async () => { throw new Error('Connection terminated due to connection timeout') },
      personalize: async (parts) => parts
    }
    await expect(runBroadcast(run, {
      getClient: () => ({ sessionId: 'inst-a' }),
      recordResult: async () => ({}),
      finish: async () => ({}),
      publish: () => {},
      acquireSlot: async () => { held += 1; return true },
      releaseSlot,
      acquireTurn: async () => true,
      releaseTurn: () => {},
      gate
    })).rejects.toThrow(/timeout/)
    expect(held).toBe(0)
    expect(releaseSlot).toHaveBeenCalled()
  })
})
