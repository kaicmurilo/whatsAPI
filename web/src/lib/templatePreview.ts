import type { TemplateFile } from '../types/api'
import { fileKindLabel } from './format'

// Mesma regra do servidor (messageParts.js): áudio não aceita legenda; vídeo, imagem e documento aceitam
const acceptsCaption = (mimetype: string): boolean => !mimetype.startsWith('audio/')

const describeFile = (file: TemplateFile, audioAsVoice: boolean): string =>
  file.mimetype.startsWith('audio/') && audioAsVoice ? `Áudio de voz · ${file.name}` : `${fileKindLabel(file.mimetype)} · ${file.name}`

// Como o contato vai receber: 1 mensagem por item, nesta ordem (texto vira legenda do 1º anexo que aceita)
export function describeDeliveryOrder(text: string, files: TemplateFile[], audioAsVoice: boolean): string[] {
  const hasText = text.trim().length > 0
  const captionIndex = hasText ? files.findIndex((file) => acceptsCaption(file.mimetype)) : -1
  const steps = files.map((file, index) => (index === captionIndex ? `${describeFile(file, audioAsVoice)} + texto como legenda` : describeFile(file, audioAsVoice)))
  return hasText && captionIndex === -1 ? ['Texto', ...steps] : steps
}

export const toTemplateFile = ({ id, name, mimetype, sizeBytes }: TemplateFile): TemplateFile => ({ id, name, mimetype, sizeBytes })
