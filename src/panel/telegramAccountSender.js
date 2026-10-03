const { Api } = require('telegram')
const { CustomFile } = require('telegram/client/uploads')
const { generateRandomLong } = require('telegram/Helpers')
const { deliverParts } = require('./broadcastRunner')
const { telegramCallsOf } = require('./telegramParts')
const { splitName } = require('./whatsappContact')
const { alternatePhone } = require('./phone')
const { coolDownTelegramAccount } = require('./telegramAccounts')

const NOT_ON_TELEGRAM_ERROR = 'Número sem Telegram (ou a privacidade do contato não deixa achar pelo telefone)'
const IMPORT_LIMIT_ERROR = 'Telegram limitou a busca por telefone desta conta (importContacts). Retome mais tarde — o limite costuma durar horas'
const BR_MOBILE_WITHOUT_NINE_LENGTH = 12
const HOUR_MS = 60 * 60 * 1000
// ponytail: o Telegram não diz quanto dura o limite de busca nem o PEER_FLOOD; 6h/24h são conservadores — ajuste se medir
const IMPORT_LIMIT_COOLDOWN_MS = 6 * HOUR_MS
const PEER_FLOOD_COOLDOWN_MS = 24 * HOUR_MS

// Problema do contato: não conta como falha seguida da conta
const RECIPIENT_SIDE_ERRORS = new Set(['USER_PRIVACY_RESTRICTED', 'PEER_ID_INVALID', 'INPUT_USER_DEACTIVATED', 'USER_IS_BLOCKED', 'YOU_BLOCKED_USER'])

// Mesmos métodos da Bot API (telegramParts) → opções do sendFile da conta
const FILE_OPTIONS = {
  sendPhoto: {},
  sendVideo: { supportsStreaming: true },
  sendVoice: { voiceNote: true },
  sendAudio: {},
  sendDocument: { forceDocument: true }
}

/**
 * Erro do MTProto → Error legível. PEER_FLOOD/FLOOD_WAIT são do remetente: contam como falha seguida (a conta sai do rodízio).
 */
const toSendError = (error) => {
  const code = error?.errorMessage || ''
  if (code === 'PEER_FLOOD') {
    return Object.assign(new Error('Telegram limitou a conta (PEER_FLOOD): muitas mensagens para quem não a tem nos contatos'), { cooldownMs: PEER_FLOOD_COOLDOWN_MS })
  }
  if (error?.seconds) return Object.assign(new Error(`Telegram pediu espera de ${error.seconds}s (FLOOD_WAIT)`), { cooldownMs: error.seconds * 1000 })
  if (error?.message === IMPORT_LIMIT_ERROR) return Object.assign(error, { cooldownMs: IMPORT_LIMIT_COOLDOWN_MS })
  return Object.assign(new Error(`Telegram: ${code || error?.message || 'erro desconhecido'}`), { recipientSide: RECIPIENT_SIDE_ERRORS.has(code) })
}

const runAccountCall = (client, user, { method, params, file }) => {
  if (method === 'sendMessage') return client.sendMessage(user, { message: params.text })
  const buffer = Buffer.from(file.data, 'base64')
  return client.sendFile(user, {
    file: new CustomFile(file.filename || 'arquivo', buffer.length, '', buffer),
    caption: params.caption,
    ...FILE_OPTIONS[method]
  })
}

// Erro de limite põe a conta inteira em pausa (todos os disparos), não só neste contato
const classifyAccountError = async (account, error) => {
  const sendError = toSendError(error)
  if (sendError.cooldownMs) await coolDownTelegramAccount(account, sendError.cooldownMs, sendError.message)
  return sendError
}

// Limite no meio do contato: ele não teve culpa — volta pendente e sai quando o disparo retomar sozinho
const deferred = (error) => ({ status: 'pending', error: error.message.slice(0, 255) })

const sendPartToUser = async (account, user, part, onLimit) => {
  try {
    for (const call of telegramCallsOf(part)) await runAccountCall(account.client, user, call)
  } catch (error) {
    const sendError = await classifyAccountError(account, error)
    if (sendError.cooldownMs) onLimit(sendError)
    throw sendError
  }
  return null
}

// Celular BR antigo sem o 9º dígito: o Telegram registra com o 9. Uma busca só (cada busca gasta a cota da conta).
const telegramPhoneOf = (phone) => (phone.length === BR_MOBILE_WITHOUT_NINE_LENGTH && alternatePhone(phone)) || phone

/**
 * Acha o usuário pelo telefone. Também salva nos contatos da conta (como o WhatsApp faz antes de enviar).
 * retryContacts = o Telegram não respondeu por limite da conta, não "sem Telegram": é falha da conta (conta como falha seguida).
 */
const resolveUserByPhone = async (client, recipient) => {
  const { firstName, lastName } = splitName(recipient.name?.trim() ? recipient.name : recipient.phone)
  const result = await client.invoke(new Api.contacts.ImportContacts({
    contacts: [new Api.InputPhoneContact({ clientId: generateRandomLong(), phone: telegramPhoneOf(recipient.phone), firstName, lastName })]
  }))
  if (result.users[0]) return result.users[0]
  if (result.retryContacts?.length > 0) throw new Error(IMPORT_LIMIT_ERROR)
  return null
}

/**
 * Envio por telefone pela conta de usuário. Mesmo contrato do sendToRecipient do WhatsApp.
 * @param {{ client: object }} account
 */
const sendToAccountRecipient = async (account, recipient, options, pauseBetweenParts) => {
  let user
  try {
    user = await resolveUserByPhone(account.client, recipient)
  } catch (error) {
    const sendError = await classifyAccountError(account, error)
    return sendError.cooldownMs ? deferred(sendError) : { status: 'failed', error: sendError.message.slice(0, 255) }
  }
  if (!user) return { status: 'failed', error: NOT_ON_TELEGRAM_ERROR, noAccount: true }
  let limitError = null
  const outcome = await deliverParts(recipient, options, (part) => sendPartToUser(account, user, part, (error) => { limitError = error }), pauseBetweenParts)
  // Nada chegou ao contato antes do limite: adia em vez de falhar
  return outcome.status === 'failed' && limitError ? deferred(limitError) : outcome
}

module.exports = { sendToAccountRecipient, toSendError, telegramPhoneOf, NOT_ON_TELEGRAM_ERROR, IMPORT_LIMIT_ERROR }
