const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15 // limite E.164
const BRAZIL_COUNTRY_CODE = '55'
const BR_MOBILE_WITH_NINE_LENGTH = 13 // 55 + DDD(2) + 9 + 8 dígitos
const BR_MOBILE_WITHOUT_NINE_LENGTH = 12 // 55 + DDD(2) + 8 dígitos
const BR_SUBSCRIBER_START = 4 // índice logo após 55 + DDD
const PERSONAL_CHAT_SUFFIX = '@c.us'

const normalizePhone = (raw) => {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS ? digits : null
}

/**
 * O WhatsApp identifica alguns celulares BR antigos sem o 9º dígito (5511 9999-8888 → 551199998888).
 * Retorna a outra forma para casar a agenda com o chat nos dois casos; null quando não se aplica.
 */
const alternatePhone = (phone) => {
  if (!phone.startsWith(BRAZIL_COUNTRY_CODE)) return null
  const subscriber = phone.slice(BR_SUBSCRIBER_START)
  if (phone.length === BR_MOBILE_WITH_NINE_LENGTH && subscriber.startsWith('9')) {
    return phone.slice(0, BR_SUBSCRIBER_START) + subscriber.slice(1)
  }
  // Celular BR de 8 dígitos começa com 6–9; fixo (2–5) nunca teve o 9 extra
  if (phone.length === BR_MOBILE_WITHOUT_NINE_LENGTH && /^[6-9]/.test(subscriber)) {
    return `${phone.slice(0, BR_SUBSCRIBER_START)}9${subscriber}`
  }
  return null
}

// Só chats individuais carregam o telefone no id; grupos (@g.us) e @lid não
const phoneFromChatId = (chatId) =>
  chatId.endsWith(PERSONAL_CHAT_SUFFIX) ? chatId.slice(0, -PERSONAL_CHAT_SUFFIX.length) : null

module.exports = { normalizePhone, alternatePhone, phoneFromChatId }
