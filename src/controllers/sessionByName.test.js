jest.mock('../database', () => ({ query: jest.fn() }))
// O controller importa o gerenciador de sessões (Chromium); a rota não usa nada dele
jest.mock('../sessions', () => ({}))

const { query } = require('../database')
const { requireSessionOwnership } = require('../middleware/authMiddleware')
const { getSessionByName } = require('./sessionController')

const mockResponse = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

// Executa a mesma sequência da rota: dono + liberação da credencial, depois o controller
const lookupByName = async (token, sessionId) => {
  const req = { params: { sessionId }, user: { user_id: 'user-1' }, token }
  const res = mockResponse()
  await requireSessionOwnership(req, res, () => getSessionByName(req, res))
  return res
}

describe('GET /session/byName/:sessionId', () => {
  beforeEach(() => query.mockReset())

  test('returns the sessionId when the API key is allowed for the instance', async () => {
    query.mockResolvedValueOnce({ rows: [{ session_id: 'loja-centro-01', status: 'connected' }] })
    const res = await lookupByName({ allowedSessionIds: ['loja-centro-01'] }, 'loja-centro-01')
    expect(res.json).toHaveBeenCalledWith({ success: true, sessionId: 'loja-centro-01', status: 'connected' })
    expect(query.mock.calls[0][1]).toEqual(['loja-centro-01', 'user-1'])
  })

  test('rejects an API key not allowed for the instance without querying', async () => {
    const res = await lookupByName({ allowedSessionIds: ['loja-norte-22'] }, 'loja-centro-01')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(query).not.toHaveBeenCalled()
  })

  test('rejects an instance that does not belong to the user', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    const res = await lookupByName({ scope: 'read write' }, 'loja-centro-01')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ sessionId: expect.anything() }))
  })
})
