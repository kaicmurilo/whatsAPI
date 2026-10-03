const { sendToRecipient } = require('./broadcastRunner')
const { saveContactBeforeSend } = require('./whatsappContact')

const recipient = { position: 0, name: 'Ana Maria', phone: '5511900000001' }
const textParts = { parts: [{ kind: 'text', text: 'Oi' }] }

const fakeClient = ({ saveContact = async () => {} } = {}) => {
  const calls = []
  return {
    calls,
    // WhatsApp devolve o número canônico (aqui sem o 9º dígito)
    getNumberId: async () => ({ _serialized: '551100000001@c.us', user: '551100000001', server: 'c.us' }),
    saveOrEditAddressbookContact: async (...args) => {
      calls.push(['save', ...args])
      return saveContact()
    },
    sendMessage: async (chatId) => {
      calls.push(['send', chatId])
      return { id: { _serialized: 'msg-1' } }
    }
  }
}

describe('salvar o contato antes do envio', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => jest.restoreAllMocks())

  test('salva com o número canônico e o nome dividido antes da primeira parte', async () => {
    const client = fakeClient()

    const outcome = await sendToRecipient(client, recipient, textParts, async () => {})

    expect(outcome.status).toBe('sent')
    expect(client.calls).toEqual([
      ['save', '551100000001', 'Ana', 'Maria', false],
      ['send', '551100000001@c.us']
    ])
  })

  test('erro ao salvar não impede o envio', async () => {
    const client = fakeClient({ saveContact: async () => { throw new Error('r: r') } })

    const outcome = await sendToRecipient(client, recipient, textParts, async () => {})

    expect(outcome.status).toBe('sent')
    expect(client.calls.map(([kind]) => kind)).toEqual(['save', 'send'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('telefone=****0001'))
  })

  test('salvar que não responde desiste no tempo limite', async () => {
    const client = fakeClient({ saveContact: () => new Promise(() => {}) })

    await expect(saveContactBeforeSend(client, '5511900000001', 'Ana', 20)).resolves.toBe(false)
  })

  test('sem nome, usa o telefone como nome', async () => {
    const client = fakeClient()

    await saveContactBeforeSend(client, '5511900000001', '  ')

    expect(client.calls).toEqual([['save', '5511900000001', '5511900000001', '', false]])
  })
})
