jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('./settingsRepository', () => ({ getSettings: jest.fn().mockResolvedValue({ suppressionEnabled: false, stopOnReply: false }) }))
jest.mock('./suppressionRepository', () => ({ phoneForms: (phone) => [phone], findSuppression: jest.fn(), hasReplySince: jest.fn() }))
jest.mock('./broadcastQueueRepository', () => ({ isRecipientRemoved: jest.fn() }))

const { query } = require('../database')
const { isRecipientRemoved } = require('./broadcastQueueRepository')
const { createBroadcastGate } = require('./broadcastGate')

const recipient = { position: 3, name: 'Ana', phone: '5511999998888' }
const gate = () => createBroadcastGate({ userId: 'u1', runId: 9, createdAt: new Date() })

beforeEach(() => jest.clearAllMocks())

test('contato removido no menu Fila não é enviado, mesmo com o disparo rodando', async () => {
  isRecipientRemoved.mockResolvedValue(true)
  expect(await gate().classify(recipient)).toEqual({ status: 'removed', error: 'Removido da fila pelo usuário' })
  expect(isRecipientRemoved).toHaveBeenCalledWith(9, 3)
  expect(query).not.toHaveBeenCalled()
})

test('contato na fila segue para as outras regras', async () => {
  isRecipientRemoved.mockResolvedValue(false)
  query.mockResolvedValue({ rows: [] })
  expect(await gate().classify(recipient)).toBeNull()
})
