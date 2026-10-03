const { telegramCallsOf, mediaMethodOf, MAX_CAPTION_LENGTH } = require('./telegramParts')

const mediaPart = (mimetype, options = {}) => ({
  kind: 'media',
  mimetype,
  media: { mimetype, data: 'AAAA', filename: 'arquivo' },
  options
})

describe('telegramCallsOf', () => {
  test('texto vira sendMessage', () => {
    expect(telegramCallsOf({ kind: 'text', text: 'Olá' })).toEqual([{ method: 'sendMessage', params: { text: 'Olá' } }])
  })

  test('imagem com legenda curta vai numa chamada só', () => {
    const [call, ...rest] = telegramCallsOf(mediaPart('image/png', { caption: 'Promo' }))
    expect(rest).toHaveLength(0)
    expect(call.method).toBe('sendPhoto')
    expect(call.params).toEqual({ caption: 'Promo' })
    expect(call.file).toMatchObject({ field: 'photo', data: 'AAAA', mimetype: 'image/png' })
  })

  test('legenda acima do limite sai como texto depois da mídia', () => {
    const caption = 'x'.repeat(MAX_CAPTION_LENGTH + 1)
    const calls = telegramCallsOf(mediaPart('video/mp4', { caption }))
    expect(calls.map((call) => call.method)).toEqual(['sendVideo', 'sendMessage'])
    expect(calls[0].params).toEqual({})
    expect(calls[1].params.text).toBe(caption)
  })
})

describe('mediaMethodOf', () => {
  test('áudio como voz só em formato aceito pelo sendVoice', () => {
    expect(mediaMethodOf('audio/ogg', { sendAudioAsVoice: true }).method).toBe('sendVoice')
    expect(mediaMethodOf('audio/wav', { sendAudioAsVoice: true }).method).toBe('sendAudio')
    expect(mediaMethodOf('audio/ogg', {}).method).toBe('sendAudio')
  })

  test('documento forçado e tipos desconhecidos vão como sendDocument', () => {
    expect(mediaMethodOf('video/mp4', { sendMediaAsDocument: true }).method).toBe('sendDocument')
    expect(mediaMethodOf('application/pdf').method).toBe('sendDocument')
  })
})
