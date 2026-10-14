jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))
jest.mock('./settingsRepository', () => ({ getSettings: jest.fn() }))

const { query } = require('../database')
const { getSettings } = require('./settingsRepository')
const { isBatchable, joinParts, senderKeyOf, parseBatchInput } = require('./messageBatchPolicy')
const { queueIfBatching, flushBatch, MAX_ATTEMPTS } = require('./messageBatcher')

const GROUP = '120363413982189751@g.us'

const fakeDeps = (client) => ({
  getClient: jest.fn((sessionId) => (client && sessionId !== 'offline-0001' ? client : null)),
  isMember: jest.fn(async () => true),
  loadDaily: jest.fn(async () => new Map()),
  recordApiSend: jest.fn(),
  deleteBatch: jest.fn(async () => {}),
  releaseBatchForRetry: jest.fn(async () => {})
})

const batchOf = (overrides) => ({ id: 7, userId: 'user-1', chatId: GROUP, sessionIds: ['loja-a-0001'], isBalanced: false, parts: ['primeira', 'segunda'], credentialId: 3, attempts: 0, ...overrides })

describe('message batching', () => {
  let logs
  beforeEach(() => {
    query.mockReset()
    getSettings.mockReset()
    logs = ['log', 'warn', 'error'].map((level) => jest.spyOn(console, level).mockImplementation(() => {}))
  })
  afterEach(() => logs.forEach((spy) => spy.mockRestore()))

  test('policy: only plain text batches; texts join with a blank line; sender kinds never mix', () => {
    expect(isBatchable('string', 'oi', undefined)).toBe(true)
    expect(isBatchable('string', 'oi', { media: { data: 'x' } })).toBe(false)
    expect(isBatchable('MessageMedia', { data: 'x' }, undefined)).toBe(false)
    expect(isBatchable('string', '', undefined)).toBe(false)
    expect(joinParts(['a', 'b', 'c'])).toBe('a\n\nb\n\nc')
    expect(senderKeyOf({ isBalanced: true, sessionIds: ['b', 'a'] })).toBe(senderKeyOf({ isBalanced: true, sessionIds: ['a', 'b'] }))
    expect(senderKeyOf({ isBalanced: false, sessionIds: ['a'] })).not.toBe(senderKeyOf({ isBalanced: true, sessionIds: ['a'] }))
  })

  test('settings: off with 5 minutes by default, 1–60 whole minutes', () => {
    expect(parseBatchInput({}).value).toEqual({ batchEnabled: false, batchWindowMinutes: 5 })
    expect(parseBatchInput({ batchEnabled: true, batchWindowMinutes: 2 }).value).toEqual({ batchEnabled: true, batchWindowMinutes: 2 })
    expect(parseBatchInput({ batchWindowMinutes: 0 }).error).toMatch(/1 e 60/)
    expect(parseBatchInput({ batchWindowMinutes: 61 }).error).toMatch(/1 e 60/)
    expect(parseBatchInput({ batchWindowMinutes: 1.5 }).error).toMatch(/1 e 60/)
    expect(parseBatchInput({ batchEnabled: 'sim' }).error).toBeDefined()
  })

  test('queue: batching off or non-text sends right away; on, the text joins the chat batch with the configured window', async () => {
    const send = { userId: 'user-1', chatId: GROUP, sessionIds: ['loja-a-0001'], isBalanced: false, contentType: 'string', content: 'oi', credentialId: 3 }
    getSettings.mockResolvedValueOnce({ batchEnabled: false, batchWindowMinutes: 5 })
    expect(await queueIfBatching(send)).toBeNull()
    expect(await queueIfBatching({ ...send, contentType: 'Location', content: {} })).toBeNull()
    expect(getSettings).toHaveBeenCalledTimes(1)

    getSettings.mockResolvedValueOnce({ batchEnabled: true, batchWindowMinutes: 3 })
    query.mockResolvedValueOnce({ rows: [{ flushAt: new Date('2026-10-14T18:03:00Z'), size: 2 }] })
    expect(await queueIfBatching(send)).toEqual({ flushAt: new Date('2026-10-14T18:03:00Z'), size: 2 })
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/ON CONFLICT \(user_id, chat_id, sender_key\) WHERE claimed_at IS NULL/)
    expect(sql).toMatch(/parts = api_message_batches\.parts \|\| EXCLUDED\.parts/)
    expect(params).toEqual(['user-1', GROUP, 'session:loja-a-0001', ['loja-a-0001'], false, 'oi', 3, 3])
  })

  test('flush: one message with all texts, recorded once as an integration send', async () => {
    const client = { sendMessage: jest.fn(async () => ({ id: { _serialized: 'm1' } })) }
    const deps = fakeDeps(client)
    await flushBatch(batchOf(), deps)
    expect(client.sendMessage).toHaveBeenCalledWith(GROUP, 'primeira\n\nsegunda')
    expect(deps.deleteBatch).toHaveBeenCalledWith(7)
    expect(deps.recordApiSend).toHaveBeenCalledTimes(1)
    expect(deps.recordApiSend.mock.calls[0][0]).toMatchObject({ sessionId: 'loja-a-0001', chatId: GROUP, credentialId: 3 })
  })

  test('flush balanced: sender picked at send time among group members', async () => {
    const client = { sendMessage: jest.fn(async () => ({})) }
    const deps = fakeDeps(client)
    deps.isMember.mockImplementation(async (_client, _group, sessionId) => sessionId === 'loja-b-0002')
    await flushBatch(batchOf({ isBalanced: true, sessionIds: ['loja-a-0001', 'loja-b-0002'] }), deps)
    expect(deps.recordApiSend.mock.calls[0][0].sessionId).toBe('loja-b-0002')
  })

  test('flush failures go back to the queue and are dropped with an error log only after the last attempt', async () => {
    const deps = fakeDeps(null)
    await flushBatch(batchOf({ sessionIds: ['offline-0001'] }), deps)
    expect(deps.releaseBatchForRetry).toHaveBeenCalledWith(7, 60)
    expect(deps.deleteBatch).not.toHaveBeenCalled()

    const broken = { sendMessage: jest.fn(async () => { throw new Error('rate-overlimit') }) }
    const brokenDeps = fakeDeps(broken)
    await flushBatch(batchOf(), brokenDeps)
    expect(brokenDeps.releaseBatchForRetry).toHaveBeenCalledTimes(1)
    expect(brokenDeps.recordApiSend).not.toHaveBeenCalled()

    const lastDeps = fakeDeps(null)
    await flushBatch(batchOf({ sessionIds: ['offline-0001'], attempts: MAX_ATTEMPTS - 1 }), lastDeps)
    expect(lastDeps.deleteBatch).toHaveBeenCalledWith(7)
    expect(lastDeps.releaseBatchForRetry).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/desistindo .*textos=2/))
  })
})
