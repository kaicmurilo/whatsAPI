jest.mock('./telegramRepository', () => ({ findTelegramLinks: jest.fn() }))
jest.mock('./telegramApi', () => ({ callTelegram: jest.fn(), uploadTelegram: jest.fn() }))
jest.mock('./telegramAccountSender', () => ({ sendToAccountRecipient: jest.fn() }))

const { findTelegramLinks } = require('./telegramRepository')
const { callTelegram } = require('./telegramApi')
const { sendToAccountRecipient } = require('./telegramAccountSender')
const { sendToTelegramRecipient, pickTelegramSender, NO_TELEGRAM_ERROR } = require('./telegramSender')

const botA = { kind: 'bot', id: '1', instanceId: 'telegram:1', userId: 'u1', token: 'ta' }
const botB = { kind: 'bot', id: '2', instanceId: 'telegram:2', userId: 'u1', token: 'tb' }
const account = { kind: 'account', id: '7', instanceId: 'tguser:7', userId: 'u1' }
const recipient = { position: 0, name: 'Ana', phone: '5511999998888' }
const textParts = { parts: [{ kind: 'text', text: 'Oi' }] }
const noPause = async () => {}
const clientOf = (sender, candidates) => ({ sender, candidates: () => candidates })

beforeEach(() => jest.resetAllMocks())

describe('pickTelegramSender', () => {
  test('prefere o bot sorteado quando o contato o abriu', () => {
    expect(pickTelegramSender(botB, [botA, botB], [{ botId: '1', chatId: '9' }, { botId: '2', chatId: '9' }])).toEqual({ instance: botB, chatId: '9' })
  })

  test('cai para outro bot do disparo que o contato abriu', () => {
    expect(pickTelegramSender(botB, [botA, botB], [{ botId: '1', chatId: '9' }])).toEqual({ instance: botA, chatId: '9' })
  })

  test('conta sorteada, mas o contato abriu um bot marcado: vai pelo bot', () => {
    expect(pickTelegramSender(account, [account, botA], [{ botId: '1', chatId: '9' }])).toEqual({ instance: botA, chatId: '9' })
  })

  test('sem bot vinculado: usa a conta (envio pelo telefone)', () => {
    expect(pickTelegramSender(botA, [botA, account], [])).toEqual({ instance: account })
  })

  test('só bots e nenhum vinculado: ninguém consegue', () => {
    expect(pickTelegramSender(botA, [botA], [{ botId: '3', chatId: '9' }])).toBeNull()
  })
})

test('contato sem vínculo e sem conta falha como problema do contato', async () => {
  findTelegramLinks.mockResolvedValue([])
  const outcome = await sendToTelegramRecipient(clientOf(botA, [botA]), recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'failed', error: NO_TELEGRAM_ERROR, noAccount: true })
  expect(callTelegram).not.toHaveBeenCalled()
})

test('envia pelo bot sorteado sem trocar o remetente', async () => {
  findTelegramLinks.mockResolvedValue([{ botId: '1', chatId: '42' }])
  callTelegram.mockResolvedValue({ message_id: 7 })
  const outcome = await sendToTelegramRecipient(clientOf(botA, [botA, botB]), recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'sent', messageId: null })
  expect(callTelegram).toHaveBeenCalledWith('ta', 'sendMessage', { chat_id: '42', text: 'Oi' })
})

test('outro bot enviou: o remetente registrado é ele', async () => {
  findTelegramLinks.mockResolvedValue([{ botId: '2', chatId: '42' }])
  callTelegram.mockResolvedValue({ message_id: 7 })
  const outcome = await sendToTelegramRecipient(clientOf(botA, [botA, botB]), recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'sent', messageId: null, senderSessionId: 'telegram:2' })
})

test('sem vínculo, a conta do disparo envia e fica registrada como remetente', async () => {
  findTelegramLinks.mockResolvedValue([])
  sendToAccountRecipient.mockResolvedValue({ status: 'sent', messageId: null })
  const outcome = await sendToTelegramRecipient(clientOf(botA, [botA, account]), recipient, textParts, noPause)
  expect(sendToAccountRecipient).toHaveBeenCalledWith(account, recipient, textParts, noPause)
  expect(outcome).toEqual({ status: 'sent', messageId: null, senderSessionId: 'tguser:7' })
})

test('bot bloqueado pelo contato vira noAccount', async () => {
  findTelegramLinks.mockResolvedValue([{ botId: '1', chatId: '42' }])
  callTelegram.mockRejectedValue(Object.assign(new Error('Telegram: Forbidden: bot was blocked by the user'), { recipientSide: true }))
  const outcome = await sendToTelegramRecipient(clientOf(botA, [botA]), recipient, textParts, noPause)
  expect(outcome).toMatchObject({ status: 'failed', noAccount: true })
})
