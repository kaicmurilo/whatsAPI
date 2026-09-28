const { loadOwnedMedia } = require('./mediaLoader')

// Parte guardada no disparo (JSONB) — só ids e nomes, nunca bytes:
//   { type: 'text', text, variations? }  |  { type: 'file', fileId, fileName, mimetype?, caption?, variations?, asVoice? }
const TRACKED_MEDIA_FAMILIES = ['audio', 'video']

// Áudio (voz ou arquivo) não aceita legenda no WhatsApp; vídeo, imagem e documento aceitam
const acceptsCaption = (mimetype) => !String(mimetype || '').startsWith('audio/')

// Texto principal primeiro, depois as variações não vazias. Uma só entrada = disparo idêntico ao de antes.
const textPool = (primary, variations) => {
  const pool = []
  if (typeof primary === 'string' && primary.trim().length > 0) pool.push(primary)
  if (Array.isArray(variations)) {
    for (const item of variations) {
      if (typeof item === 'string' && item.trim().length > 0) pool.push(item)
    }
  }
  return pool
}

const variationFields = (variations) => (variations.length > 0 ? { variations } : {})

/**
 * Modelo → partes na ordem de envio. O texto vai junto, como legenda do primeiro anexo que aceita
 * legenda (vídeo/imagem/documento) — chega como uma mensagem só. Só com áudios, o texto vai antes, separado.
 * Variações ficam na mesma parte do texto: o envio escolhe uma por contato.
 */
const partsFromTemplate = (template) => {
  const pool = textPool(template.text, template.variations)
  const [text, ...variations] = pool
  const captionIndex = text ? template.files.findIndex((file) => acceptsCaption(file.mimetype)) : -1
  const fileParts = template.files.map((file, index) => ({
    type: 'file',
    fileId: String(file.id),
    fileName: file.name,
    mimetype: file.mimetype,
    asVoice: template.audioAsVoice,
    ...(index === captionIndex ? { caption: text, ...variationFields(variations) } : {})
  }))
  const needsSeparateText = text && captionIndex === -1
  return needsSeparateText ? [{ type: 'text', text, ...variationFields(variations) }, ...fileParts] : fileParts
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
      parts.push({ kind: 'text', text: part.text, ...variationFields(Array.isArray(part.variations) ? part.variations : []) })
      continue
    }
    const loaded = await loadOwnedMedia(userId, part.fileId, { asVoice: Boolean(part.asVoice) })
    if (!loaded) return { missingFile: part.fileName || `arquivo ${part.fileId}` }
    parts.push({
      kind: 'media',
      media: loaded.media,
      mimetype: loaded.file.mimetype,
      options: part.caption ? { ...loaded.sendOptions, caption: part.caption } : loaded.sendOptions,
      ...variationFields(Array.isArray(part.variations) ? part.variations : [])
    })
  }
  return { parts }
}

// Cópia por contato: a mídia carregada é compartilhada no disparo e não pode ser mutada.
// A posição na lista (não a ordem embaralhada do envio) fixa a versão — retry manda o mesmo texto.
const partsForRecipient = (parts, position) => {
  const slot = Number.isFinite(Number(position)) ? Math.abs(Math.trunc(Number(position))) : 0
  return parts.map((part) => {
    if (part.kind === 'text') {
      const pool = textPool(part.text, part.variations)
      if (pool.length < 2) return part
      return { ...part, text: pool[slot % pool.length] }
    }
    if (part.kind === 'media') {
      const pool = textPool(part.options?.caption, part.variations)
      if (pool.length < 2) return part
      return { ...part, options: { ...part.options, caption: pool[slot % pool.length] } }
    }
    return part
  })
}

module.exports = { acceptsCaption, partsFromTemplate, partsFromAdHoc, partsOfRun, trackedPartIndex, loadRuntimeParts, partsForRecipient }
