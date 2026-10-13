jest.mock('../database', () => ({ query: jest.fn() }))

const { query } = require('../database')
const { isApiKey, createApiCredential, findApiCredentialByKey } = require('./apiCredentialRepository')
const { parseCredentialName, parseCredentialSessionIds, requirePanelLogin, restrictToSessionRoutes, putCredentialSessions } = require('./apiCredentialController')
const { isSessionAllowed } = require('../auth/credentialScope')

const mockResponse = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

describe('api credentials', () => {
  beforeEach(() => query.mockReset())

  test('creates a wak_ key and stores only its hash and visible prefix', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'CRM' }] })
    const created = await createApiCredential('user-1', 'CRM')
    const [, params] = query.mock.calls[0]
    expect(isApiKey(created.apiKey)).toBe(true)
    expect(params[2]).toMatch(/^[0-9a-f]{64}$/)
    expect(params).not.toContain(created.apiKey)
    expect(created.apiKey.startsWith(params[3])).toBe(true)
  })

  test('finds the credential by hashing the key', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'CRM' }] })
    const { apiKey } = await createApiCredential('user-1', 'CRM')
    const storedHash = query.mock.calls[0][1][2]
    query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 'user-1', last_used_at: new Date() }] })
    expect(await findApiCredentialByKey(apiKey)).toMatchObject({ user_id: 'user-1' })
    expect(query.mock.calls.at(-1)[1]).toEqual([storedHash])
  })

  test('JWTs are not API keys', () => {
    expect(isApiKey('eyJhbGciOiJIUzI1NiJ9.x.y')).toBe(false)
    expect(isApiKey(undefined)).toBe(false)
  })

  test('validates the application name', () => {
    expect(parseCredentialName({ name: '  CRM  ' })).toEqual({ name: 'CRM' })
    expect(parseCredentialName({ name: ' ' }).error).toMatch(/nome/)
    expect(parseCredentialName({ name: 'x'.repeat(61) }).error).toMatch(/60/)
  })

  test('an API key cannot manage credentials', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    requirePanelLogin({ token: { apiCredentialId: 3 } }, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    requirePanelLogin({ token: { scope: 'read write' } }, res, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  test('parses the instance allowlist: missing means all, empty is rejected', () => {
    expect(parseCredentialSessionIds({})).toEqual({ sessionIds: null })
    expect(parseCredentialSessionIds({ sessionIds: ['loja-centro-1', 'loja-centro-1'] })).toEqual({ sessionIds: ['loja-centro-1'] })
    expect(parseCredentialSessionIds({ sessionIds: [] }).error).toMatch(/ao menos uma/)
    expect(parseCredentialSessionIds({ sessionIds: 'loja' }).error).toBeDefined()
  })

  test('restricted credentials only reach the allowed instances', () => {
    const restricted = { allowedSessionIds: ['loja-centro-1'] }
    expect(isSessionAllowed(restricted, 'loja-centro-1')).toBe(true)
    expect(isSessionAllowed(restricted, 'loja-norte-22')).toBe(false)
    expect(isSessionAllowed({ allowedSessionIds: null }, 'loja-norte-22')).toBe(true)
    expect(isSessionAllowed({ scope: 'read write' }, 'loja-norte-22')).toBe(true)
  })

  test('restricted credentials cannot use account-wide panel routes', () => {
    const token = { allowedSessionIds: ['loja-centro-1'] }
    const next = jest.fn()
    const blocked = mockResponse()
    restrictToSessionRoutes({ token, path: '/contacts' }, blocked, next)
    expect(blocked.status).toHaveBeenCalledWith(403)
    restrictToSessionRoutes({ token, path: '/sessions' }, mockResponse(), next)
    expect(next).not.toHaveBeenCalled()
    restrictToSessionRoutes({ token, path: '/sessions/loja-centro-1/chats' }, mockResponse(), next)
    restrictToSessionRoutes({ token: { scope: 'read write' }, path: '/contacts' }, mockResponse(), next)
    expect(next).toHaveBeenCalledTimes(2)
  })

  describe('editing the allowed instances', () => {
    const patch = async (body, credentialId = '7') => {
      const res = mockResponse()
      await putCredentialSessions({ params: { credentialId }, body, user: { user_id: 'user-1' } }, res)
      return res
    }

    test('restricts to the given instances after checking they are owned', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ owned: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 7, sessionIds: ['loja-centro-1', 'loja-norte-22'] }] })
      const res = await patch({ sessionIds: ['loja-centro-1', 'loja-norte-22', 'loja-centro-1'] })
      const [sql, params] = query.mock.calls[1]
      expect(sql).toMatch(/UPDATE api_credentials SET session_ids/)
      expect(sql).toMatch(/user_id = \$1 AND id = \$2/)
      expect(params).toEqual(['user-1', 7, ['loja-centro-1', 'loja-norte-22']])
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    test('null releases every instance without an ownership query', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 7, sessionIds: null }] })
      await patch({ sessionIds: null })
      expect(query).toHaveBeenCalledTimes(1)
      expect(query.mock.calls[0][1]).toEqual(['user-1', 7, null])
    })

    test('rejects missing field, empty list, foreign instance, bad id and unknown credential', async () => {
      expect((await patch({})).status).toHaveBeenCalledWith(422)
      expect((await patch({ sessionIds: [] })).status).toHaveBeenCalledWith(422)
      expect((await patch({ sessionIds: ['x'] }, 'abc')).status).toHaveBeenCalledWith(422)
      query.mockResolvedValueOnce({ rows: [{ owned: 0 }] })
      expect((await patch({ sessionIds: ['loja-de-outro-1'] })).status).toHaveBeenCalledWith(422)
      query.mockResolvedValueOnce({ rows: [] })
      expect((await patch({ sessionIds: null }, '99')).status).toHaveBeenCalledWith(404)
    })
  })
})
