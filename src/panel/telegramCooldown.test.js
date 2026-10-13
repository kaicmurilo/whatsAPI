const { nextCooldown, backoffMs, COOLDOWN_POLICIES } = require('./telegramCooldown')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

test('limite de busca: 30 min, depois dobra a cada limite seguido, até 12 h', () => {
  const minutes = [1, 2, 3, 4, 5, 6, 7].map((strikes) => backoffMs(strikes, COOLDOWN_POLICIES.importLimit) / MINUTE)
  expect(minutes).toEqual([30, 60, 120, 240, 480, 720, 720])
})

test('PEER_FLOOD começa em 2 h e para em 24 h', () => {
  expect(backoffMs(1, COOLDOWN_POLICIES.peerFlood)).toBe(2 * HOUR)
  expect(backoffMs(10, COOLDOWN_POLICIES.peerFlood)).toBe(24 * HOUR)
})

test('cada limite soma um strike; FLOOD_WAIT usa o tempo do Telegram e não soma', () => {
  expect(nextCooldown(0, { policy: 'importLimit' })).toEqual({ ms: 30 * MINUTE, strikes: 1 })
  expect(nextCooldown(2, { policy: 'importLimit' })).toEqual({ ms: 120 * MINUTE, strikes: 3 })
  expect(nextCooldown(2, { fixedMs: 45000 })).toEqual({ ms: 45000, strikes: 2 })
})
