// Cliente mínimo do Telegram Bot API (https://core.telegram.org/bots/api) — fetch nativo, sem dependência
const API_BASE = 'https://api.telegram.org'
const RECIPIENT_SIDE_CODES = new Set([400, 403]) // chat não existe / bot bloqueado pelo contato

// Nunca põe o token na mensagem: ela vai para log e para o relatório
const toTelegramError = (status, body) => {
  const error = new Error(`Telegram: ${body?.description || `HTTP ${status}`}`)
  error.code = body?.error_code ?? status
  error.recipientSide = RECIPIENT_SIDE_CODES.has(error.code)
  return error
}

const post = async (token, method, body, signal) => {
  const response = await fetch(`${API_BASE}/bot${token}/${method}`, { method: 'POST', body, signal, ...(typeof body === 'string' ? { headers: { 'Content-Type': 'application/json' } } : {}) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw toTelegramError(response.status, payload)
  return payload.result
}

const callTelegram = (token, method, params = {}, { signal } = {}) => post(token, method, JSON.stringify(params), signal)

// Envio com arquivo: multipart com o campo do método (photo, video, audio, voice, document)
const uploadTelegram = (token, method, params, { field, data, mimetype, filename }) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
  }
  form.append(field, new Blob([Buffer.from(data, 'base64')], { type: mimetype }), filename || 'arquivo')
  return post(token, method, form)
}

module.exports = { callTelegram, uploadTelegram }
