jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))
jest.mock('./broadcastChannels', () => ({ getConnectedClient: jest.fn() }))
jest.mock('./broadcastSessions', () => ({
  ...jest.requireActual('./broadcastSessions'),
  listOwnedSessionIds: jest.fn(async (_userId, ids) => new Set(ids))
}))
jest.mock('./groupCacheRepository', () => ({ findCachedGroup: jest.fn(), listCachedGroups: jest.fn(), groupCacheStatus: jest.fn() }))
jest.mock('./groupCache', () => ({ refreshSessions: jest.fn(async () => {}) }))

const { getConnectedClient } = require('./broadcastChannels')
const { findCachedGroup, listCachedGroups } = require('./groupCacheRepository')
const { readGroupsInPage } = require('./groupMembership')
const { postGroupMembers, getGroups, describeAddResult } = require('./groupController')
const { restrictToSessionRoutes } = require('./apiCredentialController')

const GROUP = '120363413982189751@g.us'
const mockResponse = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })
const collection = (items) => ({ get: (id) => items.find((item) => item.id._serialized === id), getModelsArray: () => items })
const participant = (serialized, flags = {}) => {
  const [user, server] = serialized.split('@')
  return { id: { _serialized: serialized, user, server }, ...flags }
}

describe('groups', () => {
  let logs
  beforeEach(() => {
    jest.clearAllMocks()
    logs = ['log', 'warn', 'error'].map((level) => jest.spyOn(console, level).mockImplementation(() => {}))
  })
  afterEach(() => {
    logs.forEach((spy) => spy.mockRestore())
    delete global.window
  })

  test('page reader: only groups I am in, with size, my admin flag and the admins; null when the Store breaks', () => {
    const monitorParticipants = collection([
      participant('111@lid', { isAdmin: true }),
      participant('5511999998888@c.us', { isSuperAdmin: true }),
      participant('5511777776666@c.us')
    ])
    const chats = [
      { id: { _serialized: GROUP, server: 'g.us' }, formattedTitle: 'Monitoramento', groupMetadata: { participants: monitorParticipants } },
      { id: { _serialized: '999@g.us', server: 'g.us' }, groupMetadata: { participants: collection([participant('5511777776666@c.us')]) } },
      { id: { _serialized: '5511@c.us', server: 'c.us' } }
    ]
    global.window = {
      require: (name) => ({
        WAWebCollections: { Chat: { getModelsArray: () => chats }, Contact: { get: (id) => (id === '5511999998888@c.us' ? { name: 'Dono' } : null) } },
        WAWebUserPrefsMeUser: { getMaybeMeLidUser: () => ({ _serialized: '111@lid' }), getMaybeMePnUser: () => ({ _serialized: '5511000000000@c.us' }) }
      })[name]
    }
    expect(readGroupsInPage()).toEqual([{
      chatId: GROUP,
      name: 'Monitoramento',
      size: 3,
      isAdmin: true,
      admins: [
        { id: '111@lid', phone: null, name: null, isSuperAdmin: false },
        { id: '5511999998888@c.us', phone: '5511999998888', name: 'Dono', isSuperAdmin: true }
      ]
    }])
    global.window = { require: () => { throw new Error('store mudou') } }
    expect(readGroupsInPage()).toBeNull()
  })

  test('add instances: an admin instance of mine adds the others; members and offline ones are reported, not retried', async () => {
    findCachedGroup.mockResolvedValueOnce({ chatId: GROUP, memberSessionIds: ['loja-a-0001', 'loja-c-0003'], adminSessionIds: ['loja-a-0001'] })
    const chat = { addParticipants: jest.fn(async () => ({ '5511222@c.us': { code: 200 }, '5511444@c.us': { code: 403, isInviteV4Sent: true } })) }
    const clients = {
      'loja-a-0001': { info: { wid: { _serialized: '5511111@c.us' } }, getChatById: jest.fn(async () => chat) },
      'loja-b-0002': { info: { wid: { _serialized: '5511222@c.us' } } },
      'loja-d-0004': { info: { wid: { _serialized: '5511444@c.us' } } }
    }
    getConnectedClient.mockImplementation((sessionId) => clients[sessionId] || null)
    const res = mockResponse()
    await postGroupMembers({
      params: { chatId: GROUP },
      body: { sessionIds: ['loja-b-0002', 'loja-c-0003', 'loja-d-0004', 'loja-e-0005'] },
      user: { user_id: 'user-1' },
      token: { scope: 'read write' }
    }, res)
    expect(chat.addParticipants).toHaveBeenCalledWith(['5511222@c.us', '5511444@c.us'], { autoSendInviteV4: true })
    const { via, results } = res.json.mock.calls[0][0].data
    expect(via).toBe('loja-a-0001')
    expect(Object.fromEntries(results.map((r) => [r.sessionId, r.status]))).toEqual({
      'loja-b-0002': 'added', 'loja-c-0003': 'already', 'loja-d-0004': 'invited', 'loja-e-0005': 'offline'
    })
  })

  test('add instances: 409 without a connected admin of mine, 403 for an instance outside a restricted key', async () => {
    findCachedGroup.mockResolvedValueOnce({ chatId: GROUP, memberSessionIds: ['loja-a-0001'], adminSessionIds: [] })
    getConnectedClient.mockReturnValue({ info: { wid: { _serialized: 'x@c.us' } } })
    const noAdmin = mockResponse()
    await postGroupMembers({ params: { chatId: GROUP }, body: { sessionIds: ['loja-b-0002'] }, user: { user_id: 'user-1' }, token: {} }, noAdmin)
    expect(noAdmin.status).toHaveBeenCalledWith(409)

    const restricted = mockResponse()
    await postGroupMembers({ params: { chatId: GROUP }, body: { sessionIds: ['loja-b-0002'] }, user: { user_id: 'user-1' }, token: { allowedSessionIds: ['loja-a-0001'] } }, restricted)
    expect(restricted.status).toHaveBeenCalledWith(403)
    expect(findCachedGroup).toHaveBeenCalledTimes(1)
  })

  test('listing for the API: restricted key only sees its instances; restricted keys may use /groups routes', async () => {
    listCachedGroups.mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 5 })
    await getGroups({ query: { adminOnly: 'true' }, user: { user_id: 'user-1' }, token: { allowedSessionIds: ['loja-a-0001'] } }, mockResponse())
    expect(listCachedGroups.mock.calls[0][1]).toMatchObject({ allowedSessionIds: ['loja-a-0001'], adminOnly: true, perPage: 5 })

    const next = jest.fn()
    restrictToSessionRoutes({ token: { allowedSessionIds: ['loja-a-0001'] }, path: '/groups' }, mockResponse(), next)
    restrictToSessionRoutes({ token: { allowedSessionIds: ['loja-a-0001'] }, path: `/groups/${GROUP}/members` }, mockResponse(), next)
    expect(next).toHaveBeenCalledTimes(2)
    const blocked = mockResponse()
    restrictToSessionRoutes({ token: { allowedSessionIds: ['loja-a-0001'] }, path: '/groupsx' }, blocked, next)
    expect(blocked.status).toHaveBeenCalledWith(403)
  })

  test('add result mapping', () => {
    expect(describeAddResult('a', undefined).status).toBe('failed')
    expect(describeAddResult('a', { code: 409, message: 'já é participante' })).toEqual({ sessionId: 'a', status: 'failed', message: 'já é participante' })
  })
})
