const { runBroadcast } = require('./broadcastRunner')

const baseRun = (overrides = {}) => ({
  id: 1,
  recipients: [{ position: 0, name: 'Ana', phone: '5511999998888' }],
  parts: [{ kind: 'text', text: 'Oi' }],
  pacing: { minSeconds: 0, maxSeconds: 0, randomOrder: false },
  sessionIds: ['tguser:7'],
  ...overrides
})

const deps = (extra) => ({
  getClient: () => null,
  recordResult: jest.fn(),
  finish: jest.fn().mockResolvedValue(null),
  publish: () => {},
  acquireSlot: async () => true,
  releaseSlot: () => {},
  acquireTurn: async () => true,
  releaseTurn: () => {},
  ...extra
})

test('sem remetente e com conta em pausa: pausa com cooldown (retomada automática)', async () => {
  const runDeps = deps({ explainUnavailable: () => ({ code: 'cooldown', error: 'Pausado: limite até 19:09' }) })
  await runBroadcast(baseRun(), runDeps)
  expect(runDeps.finish).toHaveBeenCalledWith(1, 'paused', 'Pausado: limite até 19:09', 'cooldown')
  expect(runDeps.recordResult).not.toHaveBeenCalled()
})

test('sem explicação do canal: continua a pausa de instância desconectada (manual)', async () => {
  const runDeps = deps()
  await runBroadcast(baseRun(), runDeps)
  expect(runDeps.finish).toHaveBeenCalledWith(1, 'paused', expect.stringContaining('nenhuma instância'), 'instance')
})
