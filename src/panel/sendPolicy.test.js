const {
  matchedKeyword, firstNameOf, applyFirstName, applyFirstNameToParts,
  isInsideSendWindow, zonedDayBounds, sessionsOverCap, canResumePolicy, parseSettingsInput,
  QUIET_START_DEFAULT, QUIET_END_DEFAULT
} = require('./sendPolicy')

const zone = 'America/Sao_Paulo'
const keywords = ['SAIR', 'PARAR', 'REMOVER', 'STOP']

describe('suppression keywords', () => {
  test('matches the whole message, ignoring case and accents', () => {
    expect(matchedKeyword('SAIR', keywords)).toBe('SAIR')
    expect(matchedKeyword('  parar! ', keywords)).toBe('PARAR')
    expect(matchedKeyword('não', ['Não'])).toBe('Não')
  })

  test('does not match a sentence that only contains the word', () => {
    expect(matchedKeyword('não quero sair da consulta', keywords)).toBeNull()
    expect(matchedKeyword('sair agora', keywords)).toBeNull()
    expect(matchedKeyword('', keywords)).toBeNull()
  })
})

describe('first name', () => {
  test('uses the first token and skips unnamed contacts', () => {
    expect(firstNameOf('Maria Silva')).toBe('Maria')
    expect(firstNameOf('Sem nome')).toBeNull()
    expect(firstNameOf('  ')).toBeNull()
  })

  test('prefixes the text and strips a placeholder when there is no name', () => {
    expect(applyFirstName('Olá, tudo bem?', 'Maria')).toBe('Maria, Olá, tudo bem?')
    expect(applyFirstName('Maria, sua consulta', 'Maria')).toBe('Maria, sua consulta')
    expect(applyFirstName('{nome}, sua consulta amanhã', 'Maria')).toBe('Maria, sua consulta amanhã')
    expect(applyFirstName('{nome}, sua consulta amanhã', null)).toBe('sua consulta amanhã')
    expect(applyFirstName('Olá {nome}', null)).toBe('Olá')
  })

  test('only the first text part changes, and an empty placeholder does not send a blank bubble', () => {
    const parts = applyFirstNameToParts([
      { kind: 'text', text: '{nome}' },
      { kind: 'media', options: { caption: 'foto' } }
    ], 'Sem nome')
    expect(parts).toEqual([{ kind: 'media', options: { caption: 'foto' } }])
  })
})

describe('send window and daily cap', () => {
  const settings = { quietStart: QUIET_START_DEFAULT, quietEnd: QUIET_END_DEFAULT }

  test('08:00 is inside and 20:00 is outside in Sao Paulo', () => {
    expect(isInsideSendWindow(new Date('2026-09-28T11:00:00.000Z'), settings, zone)).toBe(true)
    expect(isInsideSendWindow(new Date('2026-09-28T23:00:00.000Z'), settings, zone)).toBe(false)
    expect(isInsideSendWindow(new Date('2026-09-28T10:30:00.000Z'), settings, zone)).toBe(false)
  })

  test('day bounds cover the local calendar day', () => {
    const { start, end } = zonedDayBounds(new Date('2026-09-28T15:00:00.000Z'), zone)
    expect(start.toISOString()).toBe('2026-09-28T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-29T03:00:00.000Z')
  })

  test('cap blocks only sessions at or above the limit', () => {
    const sent = new Map([['a', 80], ['b', 79]])
    expect([...sessionsOverCap(['a', 'b', 'c'], sent, 80)]).toEqual(['a'])
  })

  test('resume waits for the window and for at least one session under the cap', () => {
    const base = {
      settings: { ...settings, quietHoursEnabled: true, dailyCapEnabled: true, dailyCap: 80 },
      timeZone: zone,
      sessionIds: ['a'],
      sentToday: new Map([['a', 80]])
    }
    expect(canResumePolicy({ ...base, now: new Date('2026-09-28T15:00:00.000Z') })).toBe(false)
    expect(canResumePolicy({
      ...base,
      now: new Date('2026-09-28T15:00:00.000Z'),
      sentToday: new Map([['a', 10]])
    })).toBe(true)
    expect(canResumePolicy({ ...base, now: new Date('2026-09-28T23:30:00.000Z'), sentToday: new Map() })).toBe(false)
  })
})

describe('parseSettingsInput', () => {
  const valid = {
    suppressionEnabled: true,
    suppressionKeywords: ['SAIR', 'parar'],
    stopOnReply: false,
    prependFirstName: false,
    dailyCapEnabled: false,
    dailyCap: 80,
    quietHoursEnabled: false,
    quietStart: '08:00',
    quietEnd: '20:00'
  }

  test('accepts a whitelist body and drops a duplicate keyword', () => {
    const parsed = parseSettingsInput({ ...valid, suppressionKeywords: ['SAIR', 'sair', 'extra'] })
    expect(parsed.error).toBeUndefined()
    expect(parsed.settings.suppressionKeywords).toEqual(['SAIR', 'extra'])
    expect(parsed.settings.dailyCap).toBe(80)
  })

  test('rejects a sentence keyword, an equal window, and a cap outside 20–400', () => {
    expect(parseSettingsInput({ ...valid, suppressionKeywords: ['quero sair'] }).error).toMatch(/único termo/)
    expect(parseSettingsInput({ ...valid, quietStart: '08:00', quietEnd: '08:00' }).error).toMatch(/iguais/)
    expect(parseSettingsInput({ ...valid, dailyCap: 10 }).error).toMatch(/20/)
    expect(parseSettingsInput({ ...valid, suppressionEnabled: true, suppressionKeywords: [] }).error).toMatch(/ao menos uma/)
  })
})
