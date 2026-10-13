jest.mock('./telegramAccountRepository', () => ({ setAccountCooldown: jest.fn().mockResolvedValue() }))

const { setAccountCooldown } = require('./telegramAccountRepository')
const { coolDownTelegramAccount, resetTelegramAccountStrikes } = require('./telegramAccounts')

const MINUTE = 60 * 1000
const accountOf = (overrides = {}) => ({ id: '7', label: '@conta', cooldownUntil: null, cooldownStrikes: 0, ...overrides })

beforeEach(() => setAccountCooldown.mockClear())

test('limite seguido dobra a espera e grava pausa + strikes', async () => {
  const account = accountOf({ cooldownStrikes: 1 })
  const before = Date.now()
  await coolDownTelegramAccount(account, { policy: 'importLimit' }, 'limite')
  expect(account.cooldownStrikes).toBe(2)
  expect(account.cooldownUntil.getTime() - before).toBeGreaterThanOrEqual(60 * MINUTE)
  expect(setAccountCooldown).toHaveBeenCalledWith('7', { until: account.cooldownUntil, strikes: 2 })
})

test('conta já em pausa (outro disparo bateu no mesmo limite) não soma strike', async () => {
  const until = new Date(Date.now() + 10 * MINUTE)
  const account = accountOf({ cooldownUntil: until, cooldownStrikes: 1 })
  await coolDownTelegramAccount(account, { policy: 'importLimit' }, 'limite')
  expect(account.cooldownStrikes).toBe(1)
  expect(account.cooldownUntil).toBe(until)
  expect(setAccountCooldown).not.toHaveBeenCalled()
})

test('envio com sucesso zera strikes; sem strikes não grava nada', async () => {
  const account = accountOf({ cooldownStrikes: 3 })
  await resetTelegramAccountStrikes(account)
  expect(account.cooldownStrikes).toBe(0)
  expect(setAccountCooldown).toHaveBeenCalledWith('7', { until: null, strikes: 0 })
  setAccountCooldown.mockClear()
  await resetTelegramAccountStrikes(account)
  expect(setAccountCooldown).not.toHaveBeenCalled()
})
