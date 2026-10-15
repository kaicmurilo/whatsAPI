jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))

const { createDownAlertWatcher } = require('./instanceDownAlert')
const { parseAlertTarget, renderDownAlertMessage, parseDownAlertInput, DEFAULT_DOWN_ALERT_MESSAGE } = require('./downAlertMessage')

const flush = () => new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve))

describe('instance down alert', () => {
  describe('destination and message', () => {
    test('targets: agenda contact by phone, group by id; anything else is rejected', () => {
      expect(parseAlertTarget({ kind: 'contact', phone: '+55 (11) 99999-8888', name: ' Kaic ' }))
        .toEqual({ kind: 'contact', phone: '5511999998888', name: 'Kaic' })
      expect(parseAlertTarget({ kind: 'group', chatId: '120363413982189751@g.us', name: '' }))
        .toEqual({ kind: 'group', chatId: '120363413982189751@g.us', name: '120363413982189751@g.us' })
      expect(parseAlertTarget({ kind: 'contact', phone: '1234' })).toBeNull()
      expect(parseAlertTarget({ kind: 'group', chatId: '5511999998888@c.us' })).toBeNull()
      expect(parseAlertTarget({ kind: 'canal', chatId: 'x' })).toBeNull()
    })

    test('fills placeholders, keeps unknown ones and falls back to the default text', () => {
      const values = { instancia: 'loja-centro-01', status: 'desconectada', minutos: 5, desde: '13/10 20:10' }
      expect(renderDownAlertMessage('{instancia} caiu ({status}) há {minutos}min {xpto}', values))
        .toBe('loja-centro-01 caiu (desconectada) há 5min {xpto}')
      expect(renderDownAlertMessage(null, values)).toBe(renderDownAlertMessage(DEFAULT_DOWN_ALERT_MESSAGE, values))
    })

    test('settings: off by default, at least one target when on, duplicates merged, message capped', () => {
      const contact = { kind: 'contact', phone: '5511999998888', name: 'Kaic' }
      const group = { kind: 'group', chatId: '120363413982189751@g.us', name: 'Monitoramento' }
      expect(parseDownAlertInput({}).value).toEqual({ downAlertEnabled: false, downAlertTargets: [], downAlertMessage: null })
      expect(parseDownAlertInput({ downAlertEnabled: true }).error).toMatch(/ao menos um/)
      expect(parseDownAlertInput({ downAlertTargets: [{ kind: 'group', chatId: 'abc' }] }).error).toMatch(/inválido/)
      expect(parseDownAlertInput({ downAlertTargets: 'grupo' }).error).toBeDefined()
      const both = parseDownAlertInput({ downAlertEnabled: true, downAlertTargets: [contact, group, { ...contact, name: 'outro' }], downAlertMessage: '  oi  ' })
      expect(both.value).toEqual({ downAlertEnabled: true, downAlertTargets: [contact, group], downAlertMessage: 'oi' })
      expect(parseDownAlertInput({ downAlertTargets: Array.from({ length: 21 }, (_, index) => ({ ...contact, phone: `55119999900${String(index).padStart(2, '0')}` })) }).error).toMatch(/20/)
      expect(parseDownAlertInput({ downAlertEnabled: true, downAlertTargets: [contact], downAlertMessage: 'x'.repeat(1001) }).error).toMatch(/1000/)
      expect(parseDownAlertInput({ downAlertEnabled: 'sim' }).error).toBeDefined()
    })
  })

  describe('watcher', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    const setup = (stillDown = true) => {
      const sendAlert = jest.fn(async () => {})
      const onStatus = createDownAlertWatcher({ delayMs: 300000, isStillDown: () => stillDown, sendAlert })
      return { sendAlert, onStatus }
    }

    test('alerts once after 5 minutes down, not before', async () => {
      const { sendAlert, onStatus } = setup()
      onStatus('loja-centro-01', 'disconnected')
      onStatus('loja-centro-01', 'qr')
      jest.advanceTimersByTime(299999)
      expect(sendAlert).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1)
      await flush()
      expect(sendAlert).toHaveBeenCalledTimes(1)
      expect(sendAlert.mock.calls[0][0]).toBe('loja-centro-01')
      onStatus('loja-centro-01', 'disconnected')
      jest.advanceTimersByTime(600000)
      expect(sendAlert).toHaveBeenCalledTimes(1)
    })

    test('reconnecting within 5 minutes cancels; a new outage after reconnecting alerts again', async () => {
      const { sendAlert, onStatus } = setup()
      onStatus('loja-centro-01', 'disconnected')
      jest.advanceTimersByTime(200000)
      onStatus('loja-centro-01', 'connected')
      jest.advanceTimersByTime(600000)
      expect(sendAlert).not.toHaveBeenCalled()
      onStatus('loja-centro-01', 'disconnected')
      jest.advanceTimersByTime(300000)
      await flush()
      expect(sendAlert).toHaveBeenCalledTimes(1)
    })

    test('instance removed or stopped on purpose does not alert', async () => {
      const { sendAlert, onStatus } = setup(false)
      onStatus('loja-centro-01', 'disconnected')
      jest.advanceTimersByTime(300000)
      await flush()
      expect(sendAlert).not.toHaveBeenCalled()
    })

    test('a failing send is logged and does not break later alerts', async () => {
      const { sendAlert, onStatus } = setup()
      sendAlert.mockRejectedValueOnce(new Error('sem instância'))
      const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
      onStatus('loja-centro-01', 'disconnected')
      jest.advanceTimersByTime(300000)
      await flush()
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('falha ao enviar aviso'), 'sem instância')
      onStatus('loja-norte-022', 'disconnected')
      jest.advanceTimersByTime(300000)
      await flush()
      expect(sendAlert).toHaveBeenCalledTimes(2)
      logError.mockRestore()
    })
  })
})
