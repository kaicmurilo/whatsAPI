jest.mock('./broadcastService', () => ({ getConnectedClient: () => null }))

const { syncContacts, splitName } = require('./contactSync')
const { parseContactSyncInput } = require('./contactSyncController')

const contacts = [
  { id: '1', name: 'Ana Maria Souza', phone: '5511900000001' },
  { id: '2', name: 'Caio', phone: '5511900000002' }
]

const newJob = (sessionIds) => ({
  status: 'running',
  sessionIds,
  syncToPhone: false,
  contacts: contacts.length,
  total: contacts.length * sessionIds.length,
  processed: 0,
  saved: 0,
  skipped: 0,
  failed: 0,
  lostSessions: [],
  errors: [],
  error: null,
  finishedAt: null
})

const nothingSaved = async () => new Set()

const fakeClient = (failFor = null) => {
  const saved = []
  return {
    saved,
    saveOrEditAddressbookContact: async (phone, firstName, lastName, syncToPhone) => {
      if (phone === failFor) throw new Error('rate-overlimit')
      saved.push({ phone, firstName, lastName, syncToPhone })
    }
  }
}

describe('splitName', () => {
  test('first word is the first name, the rest is the last name', () => {
    expect(splitName('  Ana   Maria Souza ')).toEqual({ firstName: 'Ana', lastName: 'Maria Souza' })
    expect(splitName('Caio')).toEqual({ firstName: 'Caio', lastName: '' })
  })
})

describe('syncContacts', () => {
  test('saves every contact on every chosen instance, one worker per instance', async () => {
    const a = fakeClient()
    const b = fakeClient()
    const clients = { 'instancia-a': a, 'instancia-b': b }
    const pause = jest.fn(async () => {})
    const job = newJob(['instancia-a', 'instancia-b'])

    await syncContacts(job, contacts, { getClient: (id) => clients[id], pause, readSaved: nothingSaved })

    expect(a.saved).toEqual([
      { phone: '5511900000001', firstName: 'Ana', lastName: 'Maria Souza', syncToPhone: false },
      { phone: '5511900000002', firstName: 'Caio', lastName: '', syncToPhone: false }
    ])
    expect(b.saved).toHaveLength(2)
    expect(job).toMatchObject({ status: 'done', processed: 4, saved: 4, skipped: 0, failed: 0 })
    // uma pausa entre os 2 salvamentos de cada instância
    expect(pause).toHaveBeenCalledTimes(2)
  })

  test('instances run in parallel: a slow one does not hold the other', async () => {
    let releaseSlow
    const slow = { saveOrEditAddressbookContact: () => new Promise((resolve) => { releaseSlow = resolve }) }
    const fast = fakeClient()
    const job = newJob(['instancia-a', 'instancia-b'])

    const running = syncContacts(job, contacts, { getClient: (id) => (id === 'instancia-a' ? slow : fast), pause: async () => {}, readSaved: nothingSaved })
    await new Promise(setImmediate)
    expect(fast.saved).toHaveLength(2)

    releaseSlow()
    await new Promise(setImmediate)
    releaseSlow()
    await running
    expect(job).toMatchObject({ status: 'done', saved: 4 })
  })

  test('skips contacts already saved on that account, including the 9th-digit variant', async () => {
    const a = fakeClient()
    const pause = jest.fn(async () => {})
    const job = newJob(['instancia-a'])

    // Ana salva sem o 9º dígito na conta
    await syncContacts(job, contacts, { getClient: () => a, pause, readSaved: async () => new Set(['551100000001']) })

    expect(a.saved.map((entry) => entry.phone)).toEqual(['5511900000002'])
    expect(job).toMatchObject({ status: 'done', processed: 2, saved: 1, skipped: 1, failed: 0 })
    expect(pause).not.toHaveBeenCalled()
  })

  test('a failed save does not stop the others and is reported', async () => {
    const a = fakeClient('5511900000001')
    const job = newJob(['instancia-a'])

    await syncContacts(job, contacts, { getClient: () => a, pause: async () => {}, readSaved: nothingSaved })

    expect(a.saved.map((entry) => entry.phone)).toEqual(['5511900000002'])
    expect(job).toMatchObject({ status: 'done', saved: 1, failed: 1 })
    expect(job.errors).toEqual([{ name: 'Ana Maria Souza', sessionId: 'instancia-a', error: 'rate-overlimit' }])
  })

  test('an instance that drops stops only its worker', async () => {
    const b = fakeClient()
    const job = newJob(['instancia-a', 'instancia-b'])

    await syncContacts(job, contacts, { getClient: (id) => (id === 'instancia-b' ? b : null), pause: async () => {}, readSaved: nothingSaved })

    expect(b.saved).toHaveLength(2)
    expect(job).toMatchObject({ status: 'done', processed: 4, saved: 2, failed: 2, lostSessions: ['instancia-a'], error: 'Caiu no meio: instancia-a' })
  })

  test('stops when no chosen instance is connected', async () => {
    const job = newJob(['instancia-a'])

    await syncContacts(job, contacts, { getClient: () => null, pause: async () => {}, readSaved: nothingSaved })

    expect(job).toMatchObject({ status: 'stopped', processed: 2, saved: 0, failed: 2 })
    expect(job.finishedAt).not.toBeNull()
  })
})

describe('parseContactSyncInput', () => {
  test('accepts chosen contacts or all matching the search', () => {
    expect(parseContactSyncInput({ sessionIds: ['instancia-a'], contactIds: ['1', '1', '2'], syncToPhone: true }).input)
      .toEqual({ sessionIds: ['instancia-a'], contactIds: ['1', '2'], search: null, syncToPhone: true })
    expect(parseContactSyncInput({ sessionIds: ['instancia-a'], all: true, search: ' ana ' }).input)
      .toEqual({ sessionIds: ['instancia-a'], contactIds: null, search: 'ana', syncToPhone: false })
  })

  test('rejects missing instances and invalid contacts', () => {
    expect(parseContactSyncInput({ contactIds: ['1'] }).error).toBeTruthy()
    expect(parseContactSyncInput({ sessionIds: [], contactIds: ['1'] }).error).toBeTruthy()
    expect(parseContactSyncInput({ sessionIds: ['instancia-a'], contactIds: [] }).error).toBeTruthy()
    expect(parseContactSyncInput({ sessionIds: ['instancia-a'], contactIds: ['1; DROP'] }).error).toBe('Contato inválido')
  })
})
