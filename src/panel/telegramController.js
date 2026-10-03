const { sendErrorResponse } = require('../utils')
const { connectTelegramBot, removeTelegramBot, listTelegramInstances } = require('./telegramBots')
const { listAccountInstances, removeTelegramAccount } = require('./telegramAccounts')
const { startAccountLogin, continueAccountLogin } = require('./telegramAccountLogin')
const { telegramInstanceId } = require('./broadcastSessions')
const { normalizePhone } = require('./phone')

// Formato do @BotFather ("123456:ABC-..."). Também impede que o token mexa no caminho da URL do Bot API.
const BOT_TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/
const NUMERIC_ID_PATTERN = /^\d{1,20}$/
const API_ID_PATTERN = /^\d{3,12}$/
const API_HASH_PATTERN = /^[a-f0-9]{32}$/
const LOGIN_CODE_PATTERN = /^\d{4,8}$/
const LOGIN_ID_PATTERN = /^[0-9a-f-]{36}$/
const MAX_PASSWORD_LENGTH = 256

// Bots e contas do Telegram, no formato de instância
const getTelegramInstances = async (req, res) => {
  const userId = req.user.user_id
  try {
    const [bots, accounts] = await Promise.all([listTelegramInstances(userId), listAccountInstances(userId)])
    res.json({ success: true, data: [...bots, ...accounts] })
  } catch (error) {
    console.error(`[telegram] falha ao listar instâncias user=${userId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao listar as instâncias do Telegram')
  }
}

const createTelegramBot = async (req, res) => {
  const userId = req.user.user_id
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!BOT_TOKEN_PATTERN.test(token)) return sendErrorResponse(res, 422, 'Token inválido: copie o token completo que o @BotFather enviou')
  try {
    const { bot, error } = await connectTelegramBot(userId, token)
    if (error) return sendErrorResponse(res, 409, 'Este bot já está conectado em outra conta')
    const instances = await listTelegramInstances(userId)
    res.status(201).json({ success: true, data: instances.find((instance) => instance.sessionId === telegramInstanceId(bot.id)) })
  } catch (error) {
    if (error.code === 401 || error.code === 404) return sendErrorResponse(res, 422, 'O Telegram recusou este token')
    console.error(`[telegram] falha ao conectar bot user=${userId}: ${error.message}`)
    sendErrorResponse(res, 502, 'Não foi possível falar com o Telegram agora')
  }
}

const deleteTelegramBot = async (req, res) => {
  const userId = req.user.user_id
  const { botId } = req.params
  if (!NUMERIC_ID_PATTERN.test(botId)) return sendErrorResponse(res, 422, 'Bot inválido')
  try {
    if (!await removeTelegramBot(userId, botId)) return sendErrorResponse(res, 404, 'Bot não encontrado')
    res.json({ success: true })
  } catch (error) {
    console.error(`[telegram] falha ao remover bot user=${userId} bot=${botId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover o bot do Telegram')
  }
}

const parseLoginStart = (body) => {
  const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '')
  if (!phone) return { error: 'Telefone inválido: use DDI + DDD + número' }
  const apiId = String(body?.apiId ?? '').trim()
  const apiHash = String(body?.apiHash ?? '').trim().toLowerCase()
  if (!API_ID_PATTERN.test(apiId) || !API_HASH_PATTERN.test(apiHash)) return { error: 'api_id e api_hash inválidos (copie de my.telegram.org → API development tools)' }
  return { input: { phone: `+${phone}`, apiId: Number(apiId), apiHash } }
}

// Passo 1: telefone + credenciais do app → o Telegram manda o código
const startTelegramAccountLogin = async (req, res) => {
  const userId = req.user.user_id
  const { input, error } = parseLoginStart(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const result = await startAccountLogin(userId, input)
    if (result.error) return sendErrorResponse(res, ...result.error)
    console.log(`[telegram] login de conta iniciado user=${userId} telefone=****${input.phone.slice(-4)}`)
    res.status(202).json({ success: true, data: { loginId: result.loginId } })
  } catch (loginError) {
    console.error(`[telegram] falha ao iniciar login user=${userId}: ${loginError.message}`)
    sendErrorResponse(res, 502, 'Não foi possível falar com o Telegram agora')
  }
}

// Passo 2/3: código (e senha de duas etapas, se a conta tiver)
const continueTelegramAccountLogin = async (req, res) => {
  const userId = req.user.user_id
  const { loginId } = req.params
  const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\D/g, '') : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!LOGIN_ID_PATTERN.test(loginId)) return sendErrorResponse(res, 422, 'Login inválido')
  if (code && !LOGIN_CODE_PATTERN.test(code)) return sendErrorResponse(res, 422, 'Código inválido')
  if (password.length > MAX_PASSWORD_LENGTH) return sendErrorResponse(res, 422, 'Senha muito longa')
  try {
    const result = await continueAccountLogin(userId, loginId, { code, password })
    if (result.error) return sendErrorResponse(res, ...result.error)
    if (result.needs) return res.json({ success: true, data: { needs: result.needs } })
    const accounts = await listAccountInstances(userId)
    res.status(201).json({ success: true, data: { instance: accounts.find((account) => account.sessionId === result.instanceId) } })
  } catch (loginError) {
    console.error(`[telegram] falha no login user=${userId}: ${loginError.message}`)
    sendErrorResponse(res, 502, 'Não foi possível concluir o login no Telegram')
  }
}

const deleteTelegramAccount = async (req, res) => {
  const userId = req.user.user_id
  const { accountId } = req.params
  if (!NUMERIC_ID_PATTERN.test(accountId)) return sendErrorResponse(res, 422, 'Conta inválida')
  try {
    if (!await removeTelegramAccount(userId, accountId)) return sendErrorResponse(res, 404, 'Conta não encontrada')
    res.json({ success: true })
  } catch (error) {
    console.error(`[telegram] falha ao remover conta user=${userId} conta=${accountId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao remover a conta do Telegram')
  }
}

module.exports = {
  getTelegramInstances, createTelegramBot, deleteTelegramBot, startTelegramAccountLogin, continueTelegramAccountLogin, deleteTelegramAccount
}
