const { loadOwnedMedia } = require('./mediaLoader')

// Parte guardada no disparo (JSONB) — só ids e nomes, nunca bytes:
//   { type: 'text', text }  |  { type: 'file', fileId, fileName, mimetype?, caption?, asVoice? }
const TRACKED_MEDIA_FAMILIES = ['audio', 'video']

// Áudio (voz ou arquivo) não aceita legenda no WhatsApp; vídeo, imagem e documento aceitam
const acceptsCaption = (mimetype) => !String(mimetype || '').startsWith('audio/')

/**
 * Modelo → partes na ordem de envio. O texto vai junto, como legenda do primeiro anexo que aceita
 * legenda (vídeo/imagem/documento) — chega como uma mensagem só. Só com áudios, o texto vai antes, separado.
 */
const partsFromTemplate = (template) => {
  const captionIndex = template.text ? template.files.findIndex((file) => acceptsCaption(file.mimetype)) : -1
  const fileParts = template.files.map((file, index) => ({
    type: 'file',
    fileId: String(file.id),
    fileName: file.name,
    mimetype: file.mimetype,
    asVoice: template.audioAsVoice,
    ...(index === captionIndex ? { caption: template.text } : {})
  }))
  const needsSeparateText = template.text && captionIndex === -1
  return needsSeparateText ? [{ type: 'text', text: template.text }, ...fileParts] : fileParts
}

// Envio avulso (formato antigo): texto sozinho, ou arquivo com o texto de legenda
const partsFromAdHoc = ({ text, fileId, fileName }) =>
  fileId ? [{ type: 'file', fileId: String(fileId), fileName, caption: text || null }] : [{ type: 'text', text }]

// Disparos anteriores aos modelos não têm `parts`: remonta a partir de text/file_id
const partsOfRun = (run) => (Array.isArray(run.parts) && run.parts.length > 0 ? run.parts : partsFromAdHoc(run))

// Parte cujos tiques entram no relatório: primeiro áudio/vídeo ("reproduzido"), senão a primeira
const trackedPartIndex = (parts) => {
  const index = parts.findIndex((part) => part.type === 'file' && TRACKED_MEDIA_FAMILIES.includes(String(part.mimetype || '').split('/')[0]))
  return index === -1 ? 0 : index
}

/**
 * Partes guardadas → partes prontas para enviar (mídia carregada da biblioteca uma vez por disparo).
 * @returns {{ parts?: object[], missingFile?: string }}
 */
const loadRuntimeParts = async (userId, storedParts) => {
  const parts = []
  for (const part of storedParts) {
    if (part.type === 'text') {
      parts.push({ kind: 'text', text: part.text })
      continue
    }
    const loaded = await loadOwnedMedia(userId, part.fileId, { asVoice: Boolean(part.asVoice) })
    if (!loaded) return { missingFile: part.fileName || `arquivo ${part.fileId}` }
    parts.push({
      kind: 'media',
      media: loaded.media,
      mimetype: loaded.file.mimetype,
      options: part.caption ? { ...loaded.sendOptions, caption: part.caption } : loaded.sendOptions
    })
  }
  return { parts }
}

module.exports = { acceptsCaption, partsFromTemplate, partsFromAdHoc, partsOfRun, trackedPartIndex, loadRuntimeParts }
