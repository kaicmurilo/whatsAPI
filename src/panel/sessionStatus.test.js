jest.mock('../database', () => ({ query: jest.fn(() => Promise.resolve({ rowCount: 1 })) }))

const { query } = require('../database')
const { setSessionStatus, getSessionStatus } = require('./panelEvents')

describe('session status', () => {
  test('mirrors every status change into whatsapp_sessions.status', () => {
    setSessionStatus('loja-centro-01', 'connected')
    expect(getSessionStatus('loja-centro-01')).toBe('connected')
    const [sql, params] = query.mock.calls.at(-1)
    expect(sql).toMatch(/UPDATE whatsapp_sessions SET status/)
    expect(params).toEqual(['loja-centro-01', 'connected'])
  })

  test('a database failure does not break the status event', async () => {
    query.mockImplementationOnce(() => Promise.reject(new Error('db down')))
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => setSessionStatus('loja-centro-01', 'disconnected')).not.toThrow()
    expect(getSessionStatus('loja-centro-01')).toBe('disconnected')
    await new Promise((resolve) => setImmediate(resolve))
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('falha ao gravar status'), 'db down')
    logError.mockRestore()
  })
})
