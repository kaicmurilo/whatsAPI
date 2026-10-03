// Parte pronta do disparo (loadRuntimeParts) → chamadas do Bot API, na ordem
const MAX_CAPTION_LENGTH = 1024 // Telegram corta legenda em 1024; texto aceita 4096
const VOICE_MIMETYPES = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'] // formatos que o sendVoice aceita

const familyOf = (mimetype) => String(mimetype || '').split('/')[0]

const mediaMethodOf = (mimetype, options = {}) => {
  if (options.sendMediaAsDocument) return { method: 'sendDocument', field: 'document' }
  const family = familyOf(mimetype)
  if (family === 'image') return { method: 'sendPhoto', field: 'photo' }
  if (family === 'video') return { method: 'sendVideo', field: 'video' }
  if (family === 'audio') {
    return options.sendAudioAsVoice && VOICE_MIMETYPES.includes(mimetype)
      ? { method: 'sendVoice', field: 'voice' }
      : { method: 'sendAudio', field: 'audio' }
  }
  return { method: 'sendDocument', field: 'document' }
}

const textCall = (text) => ({ method: 'sendMessage', params: { text } })

/**
 * @returns {{ method: string, params: object, file?: { field, data, mimetype, filename } }[]}
 * Legenda acima do limite sai como mensagem de texto logo depois da mídia (nada é cortado).
 */
const telegramCallsOf = (part) => {
  if (part.kind === 'text') return [textCall(part.text)]
  const { method, field } = mediaMethodOf(part.mimetype || part.media.mimetype, part.options)
  const caption = part.options?.caption || null
  const fitsCaption = caption && caption.length <= MAX_CAPTION_LENGTH
  const mediaCall = {
    method,
    params: fitsCaption ? { caption } : {},
    file: { field, data: part.media.data, mimetype: part.media.mimetype, filename: part.media.filename }
  }
  return caption && !fitsCaption ? [mediaCall, textCall(caption)] : [mediaCall]
}

module.exports = { telegramCallsOf, mediaMethodOf, MAX_CAPTION_LENGTH }
