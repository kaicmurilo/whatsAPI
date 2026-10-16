jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))
jest.mock('./settingsRepository', () => ({ getSettings: jest.fn() }))
jest.mock('./messageBatchRepository', () => ({
  enqueueBatchPart: jest.fn(),
  claimDueBatches: jest.fn(),
  deleteBatch: jest.fn(),
  releaseBatchForRetry: jest.fn()
}))

const { getSettings } = require('./settingsRepository')
const { enqueueBatchPart } = require('./messageBatchRepository')
const { isBatchable, joinParts, senderKeyOf, parseBatchInput } = require('./messageBatchPolicy')
const { queueIfBatching, flushBatch, RETRY_DELAY_MS } = require('./messageBatcher')

const GROUP = '120363413982189751@g.us'
const NOW = Date.parse('2026-10-14T18:03:00Z')

// online: instâncias conectadas; members: quem está no grupo; userSessions: todas as instâncias do usuário
const fakeDeps = ({ client = { sendMessage: jest.fn(async () => ({ id: { _serialized: 'm1' } })) }, online = ['loja-a-0001'], members = null, userSessions = ['loja-a-0001'] } = {}) => ({
  client,
  getClient: jest.fn((sessionId) => (online.includes(sessionId) ? client : null)),
  isMember: jest.fn(async (_client, _group, sessionId) => !members || members.includes(sessionId)),
  listUserSessions: jest.fn(async () => userSessions),
  loadDaily: jest.fn(async () => new Map()),
  recordApiSend: jest.fn(),
  deleteBatch: jest.fn(async () => {}),
  releaseBatchForRetry: jest.fn(async () => {})
})

const batchOf = (overrides) => ({
  id: '7',
  userId: 'user-1',
  chatId: GROUP,
  sessionIds: ['loja-a-0001'],
  isBalanced: false,
  allowedSessionIds: null,
  parts: ['primeira', 'segunda'],
  credentialId: 3,
  attempts: 0,
  flushAt: NOW,
  expiresAt: NOW + 300 * 1000,
  ...overrides
})

describe('message batching', () => {
  let logs
  beforeEach(() => {
    getSettings.mockReset()
    enqueueBatchPart.mockReset()
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

  test('queue: off or non-text sends right away; on, joins the Redis batch with window, TTL and the credential scope', async () => {
    const send = { userId: 'user-1', chatId: GROUP, sessionIds: ['loja-a-0001'], isBalanced: false, allowedSessionIds: ['loja-a-0001', 'loja-b-0002'], contentType: 'string', content: 'oi', credentialId: 3 }
    getSettings.mockResolvedValueOnce({ batchEnabled: false, batchWindowMinutes: 5 })
    expect(await queueIfBatching(send)).toBeNull()
    expect(await queueIfBatching({ ...send, contentType: 'Location', content: {} })).toBeNull()
    expect(getSettings).toHaveBeenCalledTimes(1)

    getSettings.mockResolvedValueOnce({ batchEnabled: true, batchWindowMinutes: 3 })
    enqueueBatchPart.mockResolvedValueOnce({ flushAt: new Date(NOW), size: 2 })
    expect(await queueIfBatching(send)).toEqual({ flushAt: new Date(NOW), size: 2 })
    expect(enqueueBatchPart).toHaveBeenCalledWith(expect.objectContaining({
      senderKey: 'session:loja-a-0001', text: 'oi', windowMinutes: 3, ttlSeconds: 300, allowedSessionIds: ['loja-a-0001', 'loja-b-0002']
    }))
  })

  test('queue: Redis down sends right away with a warning', async () => {
    getSettings.mockResolvedValueOnce({ batchEnabled: true, batchWindowMinutes: 3 })
    enqueueBatchPart.mockResolvedValueOnce(null)
    expect(await queueIfBatching({ userId: 'user-1', chatId: GROUP, sessionIds: ['a'], isBalanced: false, contentType: 'string', content: 'oi' })).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Redis indisponível/))
  })

  test('flush: one message with all texts, recorded once as an integration send', async () => {
    const deps = fakeDeps()
    await flushBatch(batchOf(), deps, NOW)
    expect(deps.client.sendMessage).toHaveBeenCalledWith(GROUP, 'primeira\n\nsegunda')
    expect(deps.deleteBatch).toHaveBeenCalledWith('7')
    expect(deps.listUserSessions).not.toHaveBeenCalled()
    expect(deps.recordApiSend.mock.calls[0][0]).toMatchObject({ sessionId: 'loja-a-0001', chatId: GROUP, credentialId: 3, batchSize: 2 })
  })

  test('flush balanced: sender picked at send time among group members', async () => {
    const deps = fakeDeps({ online: ['loja-a-0001', 'loja-b-0002'], members: ['loja-b-0002'] })
    await flushBatch(batchOf({ isBalanced: true, sessionIds: ['loja-a-0001', 'loja-b-0002'] }), deps, NOW)
    expect(deps.recordApiSend.mock.calls[0][0].sessionId).toBe('loja-b-0002')
  })

  test('failover: chosen instance down, another user instance in the group sends it', async () => {
    const deps = fakeDeps({ online: ['loja-b-0002', 'loja-c-0003'], members: ['loja-c-0003'], userSessions: ['loja-a-0001', 'loja-b-0002', 'loja-c-0003'] })
    await flushBatch(batchOf(), deps, NOW)
    expect(deps.recordApiSend.mock.calls[0][0].sessionId).toBe('loja-c-0003')
    expect(deps.deleteBatch).toHaveBeenCalledWith('7')
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/failover lote=7 enviado por loja-c-0003/))
  })

  test('failover respects the credential: instances outside its scope never send', async () => {
    const deps = fakeDeps({ online: ['loja-b-0002'], userSessions: ['loja-a-0001', 'loja-b-0002'] })
    await flushBatch(batchOf({ allowedSessionIds: ['loja-a-0001'] }), deps, NOW)
    expect(deps.client.sendMessage).not.toHaveBeenCalled()
    expect(deps.releaseBatchForRetry).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }), RETRY_DELAY_MS)
  })

  test('nobody can send or send fails: retries later, until the TTL', async () => {
    const offline = fakeDeps({ online: [] })
    await flushBatch(batchOf(), offline, NOW)
    expect(offline.releaseBatchForRetry).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }), RETRY_DELAY_MS)
    expect(offline.deleteBatch).not.toHaveBeenCalled()

    const broken = fakeDeps({ client: { sendMessage: jest.fn(async () => { throw new Error('rate-overlimit') }) } })
    await flushBatch(batchOf(), broken, NOW)
    expect(broken.releaseBatchForRetry).toHaveBeenCalledTimes(1)
    expect(broken.recordApiSend).not.toHaveBeenCalled()
  })

  test('expired: past sendAt + TTL is never sent, only logged and dropped', async () => {
    const deps = fakeDeps()
    await flushBatch(batchOf({ attempts: 4 }), deps, NOW + 300 * 1000)
    expect(deps.client.sendMessage).not.toHaveBeenCalled()
    expect(deps.deleteBatch).toHaveBeenCalledWith('7')
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/expirado sem envio lote=7 .*textos=2.*após 4 tentativa/))
  })
})
