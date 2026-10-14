jest.mock('../database', () => ({ query: jest.fn() }))
jest.mock('../sessions', () => ({ sessions: new Map(), validateSession: jest.fn() }))

const { createDownAlertWatcher } = require('./instanceDownAlert')
const { normalizeAlertChatId, renderDownAlertMessage, parseDownAlertInput, DEFAULT_DOWN_ALERT_MESSAGE } = require('./downAlertMessage')

const flush = () => new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve))

describe('instance down alert', () => {
  describe('destination and message', () => {
    test('accepts a phone in any format, a contact id and a group id', () => {
      expect(normalizeAlertChatId('+55 (11) 99999-8888')).toBe('5511999998888@c.us')
      expect(normalizeAlertChatId('5511999998888@c.us')).toBe('5511999998888@c.us')
      expect(normalizeAlertChatId('120363413982189751@g.us')).toBe('120363413982189751@g.us')
      expect(normalizeAlertChatId('1234')).toBeNull()
      expect(normalizeAlertChatId('grupo da loja')).toBeNull()
    })

    test('fills placeholders, keeps unknown ones and falls back to the default text', () => {
      const values = { instancia: 'loja-centro-01', status: 'desconectada', minutos: 5, desde: '13/10 20:10' }
      expect(renderDownAlertMessage('{instancia} caiu ({status}) há {minutos}min {xpto}', values))
        .toBe('loja-centro-01 caiu (desconectada) há 5min {xpto}')
      expect(renderDownAlertMessage(null, values)).toBe(renderDownAlertMessage(DEFAULT_DOWN_ALERT_MESSAGE, values))
    })

    test('settings: off by default, destination required when on, message capped', () => {
      expect(parseDownAlertInput({}).value).toEqual({ downAlertEnabled: false, downAlertChatId: null, downAlertMessage: null })
      expect(parseDownAlertInput({ downAlertEnabled: true }).error).toMatch(/número ou grupo/)
      expect(parseDownAlertInput({ downAlertEnabled: false, downAlertChatId: 'abc' }).error).toMatch(/inválido/)
      expect(parseDownAlertInput({ downAlertEnabled: true, downAlertChatId: '5511999998888', downAlertMessage: '  oi  ' }).value)
        .toEqual({ downAlertEnabled: true, downAlertChatId: '5511999998888@c.us', downAlertMessage: 'oi' })
      expect(parseDownAlertInput({ downAlertEnabled: true, downAlertChatId: '5511999998888', downAlertMessage: 'x'.repeat(1001) }).error).toMatch(/1000/)
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
