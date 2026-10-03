jest.mock('./telegramAccounts', () => ({ coolDownTelegramAccount: jest.fn() }))

const { coolDownTelegramAccount } = require('./telegramAccounts')
const { sendToAccountRecipient, toSendError, telegramPhoneOf, NOT_ON_TELEGRAM_ERROR, IMPORT_LIMIT_ERROR } = require('./telegramAccountSender')

const recipient = { position: 0, name: 'Ana Souza', phone: '5511999998888' }
const textParts = { parts: [{ kind: 'text', text: 'Oi' }] }
const noPause = async () => {}

beforeEach(() => coolDownTelegramAccount.mockReset())

const fakeClient = ({ users = [{ id: 1 }], retryContacts = [], sendError = null } = {}) => ({
  invoke: jest.fn().mockResolvedValue({ users, retryContacts }),
  sendMessage: jest.fn(() => (sendError ? Promise.reject(sendError) : Promise.resolve({}))),
  sendFile: jest.fn().mockResolvedValue({})
})

test('acha o contato pelo telefone e envia o texto', async () => {
  const client = fakeClient()
  const outcome = await sendToAccountRecipient({ client }, recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'sent', messageId: null })
  const [contact] = client.invoke.mock.calls[0][0].contacts
  expect(contact).toMatchObject({ phone: '5511999998888', firstName: 'Ana', lastName: 'Souza' })
  expect(client.sendMessage).toHaveBeenCalledWith({ id: 1 }, { message: 'Oi' })
})

test('número sem Telegram (ou privacidade) é problema do contato', async () => {
  const outcome = await sendToAccountRecipient({ client: fakeClient({ users: [] }) }, recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'failed', error: NOT_ON_TELEGRAM_ERROR, noAccount: true })
})

test('PEER_FLOOD põe a conta em pausa e o contato volta para a fila', async () => {
  const client = fakeClient({ sendError: { errorMessage: 'PEER_FLOOD' } })
  const outcome = await sendToAccountRecipient({ client }, recipient, textParts, noPause)
  expect(outcome.status).toBe('pending')
  expect(outcome.error).toContain('PEER_FLOOD')
  expect(coolDownTelegramAccount).toHaveBeenCalledWith({ client }, 24 * 60 * 60 * 1000, expect.stringContaining('PEER_FLOOD'))
})

test('privacidade do contato vira noAccount', () => {
  expect(toSendError({ errorMessage: 'USER_PRIVACY_RESTRICTED' }).recipientSide).toBe(true)
  expect(toSendError({ seconds: 30 }).message).toContain('30s')
})

test('áudio como voz vai com voiceNote e legenda', async () => {
  const client = fakeClient()
  const parts = { parts: [{ kind: 'media', mimetype: 'audio/ogg', media: { mimetype: 'audio/ogg', data: 'AAAA', filename: 'a.ogg' }, options: { sendAudioAsVoice: true, caption: 'Ouça' } }] }
  await sendToAccountRecipient({ client }, recipient, parts, noPause)
  expect(client.sendFile).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({ voiceNote: true, caption: 'Ouça' }))
})

test('limite de busca da conta (retryContacts) adia o contato e põe a conta em pausa', async () => {
  const client = fakeClient({ users: [], retryContacts: [1] })
  const outcome = await sendToAccountRecipient({ client }, recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'pending', error: IMPORT_LIMIT_ERROR })
  expect(client.sendMessage).not.toHaveBeenCalled()
  expect(coolDownTelegramAccount).toHaveBeenCalledWith({ client }, 6 * 60 * 60 * 1000, IMPORT_LIMIT_ERROR)
})

test('celular BR sem o 9º dígito é buscado com o 9; os demais como estão', () => {
  expect(telegramPhoneOf('556799998888')).toBe('5567999998888')
  expect(telegramPhoneOf('5567999998888')).toBe('5567999998888')
  expect(telegramPhoneOf('556732221111')).toBe('556732221111')
  expect(telegramPhoneOf('14155550123')).toBe('14155550123')
})
