// Salvar o contato na conta do WhatsApp da instância (o mesmo "Salvar contato" do WhatsApp Web)
const SAVE_BEFORE_SEND_TIMEOUT_MS = 10000

// WhatsApp pede nome e sobrenome separados
const splitName = (name) => {
  const [firstName, ...rest] = name.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

// Só os 4 últimos dígitos no log: telefone é dado pessoal
const maskPhone = (phone) => `****${String(phone).slice(-4)}`

const withTimeout = (promise, timeoutMs) => {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`sem resposta em ${timeoutMs / 1000}s`)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Antes de cada envio do disparo. Nunca bloqueia: erro ou demora só vira log e o envio segue.
 * @param {string} phone número canônico que o WhatsApp devolveu para o chat (resolve o 9º dígito)
 * @returns {Promise<boolean>} salvou ou não
 */
const saveContactBeforeSend = async (client, phone, name, timeoutMs = SAVE_BEFORE_SEND_TIMEOUT_MS) => {
  const { firstName, lastName } = splitName(name?.trim() ? name : phone)
  try {
    await withTimeout(client.saveOrEditAddressbookContact(phone, firstName, lastName, false), timeoutMs)
    return true
  } catch (error) {
    console.warn(`[panel] não salvou o contato antes do envio telefone=${maskPhone(phone)}: ${error?.message || error}`)
    return false
  }
}

module.exports = { splitName, saveContactBeforeSend }
