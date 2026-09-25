const { MessageMedia } = require('whatsapp-web.js')
const { findOwnedFile } = require('./fileRepository')
const { readFileBase64 } = require('./fileStorage')

// Limite do WhatsApp Web para imagem/vídeo/áudio como mídia (com play/preview no chat).
// 16 MB é o limite do app de celular — não vale aqui, o painel envia pelo WhatsApp Web.
// Acima disso vai como documento (até 2 GB), que chega como arquivo para baixar.
const MAX_INLINE_MEDIA_BYTES = 64 * 1000 * 1000
const INLINE_MEDIA_FAMILIES = ['image', 'video', 'audio']

const familyOf = (mimetype) => mimetype.split('/')[0]

const shouldSendAsDocument = ({ mimetype, sizeBytes }) =>
  INLINE_MEDIA_FAMILIES.includes(familyOf(mimetype)) && sizeBytes > MAX_INLINE_MEDIA_BYTES

// Áudio como "mensagem de voz" (gravado, com waveform) em vez de arquivo de música
const buildSendOptions = (file, { asVoice }) => {
  if (shouldSendAsDocument(file)) return { sendMediaAsDocument: true }
  if (asVoice && familyOf(file.mimetype) === 'audio') return { sendAudioAsVoice: true }
  return {}
}

/**
 * Arquivo da biblioteca → MessageMedia com o nome original (o WhatsApp mostra esse nome no documento)
 * + opções de envio que dependem do arquivo. Legenda fica a cargo de quem envia.
 */
const loadOwnedMedia = async (userId, fileId, { asVoice = false } = {}) => {
  const file = await findOwnedFile(userId, fileId)
  if (!file) return null
  const base64 = await readFileBase64(file.storageKey)
  return {
    file,
    media: new MessageMedia(file.mimetype, base64, file.name, file.sizeBytes),
    sendOptions: buildSendOptions(file, { asVoice })
  }
}

module.exports = { loadOwnedMedia, shouldSendAsDocument, buildSendOptions }
