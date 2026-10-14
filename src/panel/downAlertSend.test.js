jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))
jest.mock('./balancedSender', () => ({ pickBalancedSender: jest.fn() }))
jest.mock('./apiSendRepository', () => ({ loadTodayApiSends: jest.fn() }))

const { pickBalancedSender } = require('./balancedSender')
const { sendToTarget } = require('./instanceDownAlert')

const fakeClient = (numberId = { _serialized: '5511999998888@c.us' }) => ({
  getNumberId: jest.fn(async () => numberId),
  sendMessage: jest.fn(async () => ({}))
})

const base = { sessionId: 'loja-centro-01', userId: 'user-1', otherSessionIds: ['loja-norte-022'], text: 'caiu' }

describe('sending the down alert to a target', () => {
  let log
  beforeEach(() => {
    log = ['log', 'warn', 'error'].map((level) => jest.spyOn(console, level).mockImplementation(() => {}))
  })
  afterEach(() => log.forEach((spy) => spy.mockRestore()))

  test('group goes straight to the group id, picked among members of that group', async () => {
    const client = fakeClient()
    pickBalancedSender.mockResolvedValueOnce({ sender: { sessionId: 'loja-norte-022', client } })
    await sendToTarget({ ...base, target: { kind: 'group', chatId: '120363413982189751@g.us', name: 'Monitor' } })
    expect(pickBalancedSender.mock.calls[0][0].chatId).toBe('120363413982189751@g.us')
    expect(client.getNumberId).not.toHaveBeenCalled()
    expect(client.sendMessage).toHaveBeenCalledWith('120363413982189751@g.us', 'caiu')
  })

  test('contact is resolved by the sender before sending; no WhatsApp means no send', async () => {
    const client = fakeClient()
    pickBalancedSender.mockResolvedValueOnce({ sender: { sessionId: 'loja-norte-022', client } })
    await sendToTarget({ ...base, target: { kind: 'contact', phone: '5511999998888', name: 'Kaic' } })
    expect(client.getNumberId).toHaveBeenCalledWith('5511999998888')
    expect(client.sendMessage).toHaveBeenCalledWith('5511999998888@c.us', 'caiu')

    const noAccount = fakeClient(null)
    pickBalancedSender.mockResolvedValueOnce({ sender: { sessionId: 'loja-norte-022', client: noAccount } })
    await sendToTarget({ ...base, target: { kind: 'contact', phone: '5511000000000', name: 'Sem' } })
    expect(noAccount.sendMessage).not.toHaveBeenCalled()
  })

  test('no sender available or a send failure is logged, never thrown', async () => {
    pickBalancedSender.mockResolvedValueOnce({ error: [409, 'Nenhuma das instâncias informadas está conectada'] })
    await expect(sendToTarget({ ...base, target: { kind: 'contact', phone: '5511999998888', name: 'Kaic' } })).resolves.toBeUndefined()
    const broken = fakeClient()
    broken.sendMessage.mockRejectedValueOnce(new Error('rate'))
    pickBalancedSender.mockResolvedValueOnce({ sender: { sessionId: 'loja-norte-022', client: broken } })
    await expect(sendToTarget({ ...base, target: { kind: 'group', chatId: '120363413982189751@g.us', name: 'Monitor' } })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('falha ao avisar'), 'rate')
  })
})
