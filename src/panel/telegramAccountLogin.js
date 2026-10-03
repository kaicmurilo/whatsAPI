const { randomUUID } = require('crypto')
const { Api } = require('telegram')
const { createTelegramClient, saveLoggedAccount } = require('./telegramAccounts')

const LOGIN_TTL_MS = 10 * 60 * 1000

// ponytail: login em andamento em memória — reiniciar o servidor no meio pede para começar de novo
const pendingLogins = new Map()

const LOGIN_ERRORS = {
  PHONE_NUMBER_INVALID: [422, 'Número de telefone inválido para o Telegram'],
  PHONE_NUMBER_BANNED: [422, 'Este número está banido no Telegram'],
  API_ID_INVALID: [422, 'api_id / api_hash inválidos (confira em my.telegram.org)'],
  PHONE_CODE_INVALID: [422, 'Código incorreto'],
  PHONE_CODE_EXPIRED: [410, 'Código expirou. Comece o login de novo'],
  PASSWORD_HASH_INVALID: [422, 'Senha de verificação em duas etapas incorreta'],
  SIGN_UP_REQUIRED: [422, 'Este número não tem conta no Telegram']
}

const loginErrorOf = (error) => {
  const code = error?.errorMessage || error?.message
  if (LOGIN_ERRORS[code]) return LOGIN_ERRORS[code]
  if (error?.seconds) return [429, `O Telegram pediu para esperar ${error.seconds}s antes de tentar de novo`]
  return null
}

const discardLogin = (loginId) => {
  const pending = pendingLogins.get(loginId)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingLogins.delete(loginId)
  pending.client.disconnect().catch(() => {})
}

/**
 * Passo 1: pede o código ao Telegram (chega no app do Telegram ou por SMS).
 * @returns {Promise<{ loginId?: string, error?: [number, string] }>}
 */
const startAccountLogin = async (userId, { phone, apiId, apiHash }) => {
  const client = createTelegramClient('', apiId, apiHash)
  try {
    await client.connect()
    const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, phone)
    const loginId = randomUUID()
    const timer = setTimeout(() => discardLogin(loginId), LOGIN_TTL_MS)
    timer.unref()
    pendingLogins.set(loginId, { userId, client, phone, apiId, apiHash, phoneCodeHash, step: 'code', timer })
    return { loginId }
  } catch (error) {
    await client.disconnect().catch(() => {})
    const known = loginErrorOf(error)
    if (known) return { error: known }
    throw error
  }
}

const signInWithCode = async (pending, code) => {
  const result = await pending.client.invoke(new Api.auth.SignIn({ phoneNumber: pending.phone, phoneCodeHash: pending.phoneCodeHash, phoneCode: code }))
  if (result instanceof Api.auth.AuthorizationSignUpRequired) throw Object.assign(new Error('SIGN_UP_REQUIRED'), { errorMessage: 'SIGN_UP_REQUIRED' })
}

// A lib repete o pedido de senha a cada erro; onError devolve true para parar e o erro sobe
const signInWithPassword = async (pending, password) => {
  let failure = null
  await pending.client.signInWithPassword(
    { apiId: pending.apiId, apiHash: pending.apiHash },
    { password: async () => password, onError: async (error) => { failure = error; return true } }
  ).catch((error) => { throw failure || error })
}

const advanceLogin = async (pending, { code, password }) => {
  if (pending.step === 'code') {
    if (!code) return { needs: 'code' }
    try {
      await signInWithCode(pending, code)
      return { done: true }
    } catch (error) {
      if (error?.errorMessage !== 'SESSION_PASSWORD_NEEDED') throw error
      pending.step = 'password'
    }
  }
  if (!password) return { needs: 'password' }
  await signInWithPassword(pending, password)
  return { done: true }
}

/**
 * Passo 2/3: código; se a conta tem verificação em duas etapas, a senha (na mesma chamada ou na próxima).
 * @returns {Promise<{ needs?: 'code'|'password', instanceId?: string, error?: [number, string] }>}
 */
const continueAccountLogin = async (userId, loginId, input) => {
  const pending = pendingLogins.get(loginId)
  if (!pending || pending.userId !== userId) return { error: [410, 'Login expirou. Comece de novo'] }
  try {
    const step = await advanceLogin(pending, input)
    if (step.needs) return { needs: step.needs }
    clearTimeout(pending.timer)
    pendingLogins.delete(loginId)
    const saved = await saveLoggedAccount(userId, pending.client, pending)
    if (saved.error) {
      await pending.client.disconnect().catch(() => {})
      return { error: [409, 'Esta conta do Telegram já está em outra conta do painel'] }
    }
    return { instanceId: saved.instanceId }
  } catch (error) {
    const known = loginErrorOf(error)
    if (known?.[0] === 410) discardLogin(loginId)
    if (known) return { error: known }
    discardLogin(loginId)
    throw error
  }
}

module.exports = { startAccountLogin, continueAccountLogin }
