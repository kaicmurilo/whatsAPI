jest.mock('../database', () => ({ query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })) }))

const { query } = require('../database')
const { recordApiSend, loadDailyApiSends } = require('./apiSendRepository')
const { deleteExpiredMessages } = require('./messageRetention')

describe('integration sends and message retention', () => {
  beforeEach(() => query.mockClear())

  test('records an integration send as group or contact, tolerating a missing message', () => {
    recordApiSend({ sessionId: 'loja-centro-01', chatId: '120363000000000000@g.us', message: { id: { _serialized: 'true_x@g.us_ABC' } }, credentialId: 3 })
    recordApiSend({ sessionId: 'loja-centro-01', chatId: '5511999998888@c.us', message: undefined })
    expect(query.mock.calls[0][1]).toEqual(['loja-centro-01', 'true_x@g.us_ABC', '120363000000000000@g.us', true, 3, null])
    expect(query.mock.calls[1][1]).toEqual(['loja-centro-01', null, '5511999998888@c.us', false, null, null])
    recordApiSend({ sessionId: 'loja-centro-01', chatId: '5511999998888@c.us', batchSize: 4 })
    expect(query.mock.calls[2][1][5]).toBe(4)
  })

  test('a failed record is logged and does not throw', async () => {
    query.mockImplementationOnce(() => Promise.reject(new Error('db down')))
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => recordApiSend({ sessionId: 'loja-centro-01', chatId: '5511999998888@c.us' })).not.toThrow()
    await new Promise((resolve) => setImmediate(resolve))
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('falha ao registrar envio da integração'), 'db down')
    logError.mockRestore()
  })

  test('balancing load reads only integration sends, never the phone history', async () => {
    query.mockResolvedValueOnce({ rows: [{ sessionId: 'loja-centro-01', today: 4, lastSentAt: null }] })
    const load = await loadDailyApiSends(['loja-centro-01'], new Date('2026-10-13T03:00:00Z'), new Date('2026-10-14T03:00:00Z'))
    expect(query.mock.calls[0][0]).toMatch(/FROM api_sent_messages/)
    expect(query.mock.calls[0][0]).not.toMatch(/whatsapp_messages/)
    expect(load.get('loja-centro-01').today).toBe(4)
  })

  test('retention deletes only whatsapp_messages older than each account limit', async () => {
    query.mockResolvedValueOnce({ rowCount: 12 })
    expect(await deleteExpiredMessages()).toBe(12)
    const [sql] = query.mock.calls[0]
    expect(sql).toMatch(/DELETE FROM whatsapp_messages/)
    expect(sql).toMatch(/message_retention_hours IS NOT NULL/)
    expect(sql).toMatch(/make_interval\(hours => p\.message_retention_hours\)/)
    expect(sql).not.toMatch(/api_sent_messages/)
  })
})
