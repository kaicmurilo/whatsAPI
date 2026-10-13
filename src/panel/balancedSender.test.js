jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))

const { pickBalancedSender } = require('./balancedSender')
const { isGroupMemberInPage } = require('./groupMembership')
const { findBodyError } = require('../controllers/balancedSendController')

const GROUP = '120363000000000000@g.us'
const CONTACT = '5511999998888@c.us'

// Fakes: clients conectados, quem está no grupo e quanto cada instância enviou hoje
const scenario = ({ connected, members = [], today = {} }) => ({
  getClient: (sessionId) => (connected.includes(sessionId) ? { id: sessionId } : null),
  isMember: jest.fn(async (client) => members.includes(client.id)),
  loadDaily: jest.fn(async (sessionIds) => new Map(sessionIds.map((id) => [id, { today: today[id] ?? 0, lastSentAt: null }])))
})

describe('balanced send', () => {
  test('contact: picks the connected instance with fewest messages today', async () => {
    const deps = scenario({ connected: ['loja-a-0001', 'loja-b-0002', 'loja-c-0003'], today: { 'loja-a-0001': 9, 'loja-b-0002': 2, 'loja-c-0003': 5 } })
    const result = await pickBalancedSender({ sessionIds: ['loja-a-0001', 'loja-b-0002', 'loja-c-0003'], chatId: CONTACT, ...deps })
    expect(result.sender.sessionId).toBe('loja-b-0002')
    expect(deps.isMember).not.toHaveBeenCalled()
  })

  test('contact: disconnected instances never compete', async () => {
    const deps = scenario({ connected: ['loja-a-0001'], today: { 'loja-a-0001': 50 } })
    const result = await pickBalancedSender({ sessionIds: ['loja-a-0001', 'loja-b-0002'], chatId: CONTACT, ...deps })
    expect(result.sender.sessionId).toBe('loja-a-0001')
  })

  test('group: least loaded among members only, even if a non-member sent less', async () => {
    const deps = scenario({
      connected: ['loja-a-0001', 'loja-b-0002', 'loja-c-0003'],
      members: ['loja-a-0001', 'loja-c-0003'],
      today: { 'loja-a-0001': 7, 'loja-b-0002': 0, 'loja-c-0003': 3 }
    })
    const result = await pickBalancedSender({ sessionIds: ['loja-a-0001', 'loja-b-0002', 'loja-c-0003'], chatId: GROUP, ...deps })
    expect(result.sender.sessionId).toBe('loja-c-0003')
    expect(result.candidates).toBe(2)
    expect(deps.loadDaily).toHaveBeenCalledWith(['loja-a-0001', 'loja-c-0003'])
  })

  test('group: no connected member → 422; nobody connected → 409', async () => {
    const noMember = await pickBalancedSender({ sessionIds: ['loja-a-0001'], chatId: GROUP, ...scenario({ connected: ['loja-a-0001'] }) })
    expect(noMember.error[0]).toBe(422)
    const offline = await pickBalancedSender({ sessionIds: ['loja-a-0001'], chatId: GROUP, ...scenario({ connected: [] }) })
    expect(offline.error[0]).toBe(409)
  })

  test('membership in page matches me by LID or phone, and fails closed', () => {
    const participants = new Map([['111@lid', {}]])
    global.window = {
      require: (name) => (name === 'WAWebCollections'
        ? { Chat: { get: (id) => (id === GROUP ? { groupMetadata: { participants } } : undefined) } }
        : { getMaybeMeLidUser: () => ({ _serialized: '111@lid' }), getMaybeMePnUser: () => ({ _serialized: '5511@c.us' }) })
    }
    expect(isGroupMemberInPage(GROUP)).toBe(true)
    participants.clear()
    expect(isGroupMemberInPage(GROUP)).toBe(false)
    expect(isGroupMemberInPage('999@g.us')).toBe(false)
    global.window = { require: () => { throw new Error('store mudou') } }
    expect(isGroupMemberInPage(GROUP)).toBe(false)
    delete global.window
  })

  test('validates the body before touching instances', () => {
    expect(findBodyError({ chatId: CONTACT, contentType: 'string' })[0]).toBe(422)
    expect(findBodyError({ sessionIds: ['loja-a-0001'], chatId: 'x y', contentType: 'string' })[1]).toMatch(/chatId/)
    expect(findBodyError({ sessionIds: ['loja-a-0001'], chatId: CONTACT, contentType: 'Audio' })[1]).toMatch(/contentType/)
    expect(findBodyError({ sessionIds: ['loja-a-0001'], chatId: GROUP, contentType: 'string' })).toBeNull()
  })
})
