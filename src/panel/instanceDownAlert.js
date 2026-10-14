const fs = require('fs')
const { query } = require('../database')
const { reportTimeZone, sessionFolderPath } = require('../config')
const { sessions } = require('../sessions')
const { getSettings } = require('./settingsRepository')
const { getSessionStatus, subscribePanelEvents } = require('./panelEvents')
const { getConnectedClient } = require('./broadcastChannels')
const { isGroupMember } = require('./groupMembership')
const { loadTodayApiSends } = require('./apiSendRepository')
const { pickBalancedSender } = require('./balancedSender')
const { renderDownAlertMessage, statusLabel, targetKey } = require('./downAlertMessage')
const { serializeWid } = require('./messageMapper')

const DOWN_ALERT_DELAY_MS = 5 * 60 * 1000

// Removida ou encerrada de propósito apaga a pasta da sessão; crash/queda mantém (e o retry reabre)
const isSessionExpected = (sessionId) =>
  sessions.has(sessionId) || fs.existsSync(`${sessionFolderPath}/session-${sessionId}`)

const findOwner = async (sessionId) => {
  const result = await query('SELECT user_id FROM whatsapp_sessions WHERE session_id = $1', [sessionId])
  return result.rows[0]?.user_id || null
}

const listOtherSessionIds = async (userId, sessionId) => {
  const result = await query('SELECT session_id FROM whatsapp_sessions WHERE user_id = $1 AND session_id <> $2', [userId, sessionId])
  return result.rows.map((row) => row.session_id)
}

const formatSince = (since) => since.toLocaleString('pt-BR', {
  timeZone: reportTimeZone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
})

// Contato: o telefone da agenda vira o chat real pelo WhatsApp (resolve o 9º dígito e o LID)
const resolveTargetChatId = async (client, target) => {
  if (target.kind === 'group') return target.chatId
  return serializeWid(await client.getNumberId(target.phone))
}

/**
 * Um destino: escolhe o remetente entre as outras instâncias conectadas (grupo: só quem participa),
 * pela menor carga de envios da integração no dia.
 */
const sendToTarget = async ({ sessionId, userId, otherSessionIds, target, text }) => {
  const label = `${target.kind}=${target.name}`
  const picked = await pickBalancedSender({
    sessionIds: otherSessionIds,
    chatId: targetKey(target),
    getClient: getConnectedClient,
    isMember: isGroupMember,
    loadDaily: loadTodayApiSends
  })
  if (picked.error) {
    console.warn(`[alerta] sem como avisar ${label} sobre sessão=${sessionId} user=${userId}: ${picked.error[1]}`)
    return
  }
  const { client, sessionId: via } = picked.sender
  try {
    const chatId = await resolveTargetChatId(client, target)
    if (!chatId) {
      console.warn(`[alerta] contato sem WhatsApp ${label} sessão=${sessionId} user=${userId}`)
      return
    }
    await client.sendMessage(chatId, text)
    console.log(`[alerta] aviso enviado ${label} sessão=${sessionId} via=${via} user=${userId}`)
  } catch (error) {
    console.error(`[alerta] falha ao avisar ${label} sessão=${sessionId} via=${via} user=${userId}:`, error.message)
  }
}

/**
 * Envia o aviso para cada destino configurado, por outra instância conectada da mesma conta
 * (a que caiu não consegue avisar). Um destino que falha não impede os outros.
 */
const sendDownAlert = async (sessionId, since) => {
  const userId = await findOwner(sessionId)
  if (!userId) return
  const settings = await getSettings(userId)
  if (!settings.downAlertEnabled || settings.downAlertTargets.length === 0) return
  const status = getSessionStatus(sessionId)
  const text = renderDownAlertMessage(settings.downAlertMessage, {
    instancia: sessionId,
    status: statusLabel(status),
    minutos: Math.round((Date.now() - since.getTime()) / 60000),
    desde: formatSince(since)
  })
  const otherSessionIds = await listOtherSessionIds(userId, sessionId)
  for (const target of settings.downAlertTargets) {
    await sendToTarget({ sessionId, userId, otherSessionIds, target, text })
  }
}

/**
 * Um temporizador por instância: começa na primeira mudança para fora de "connected" e é cancelado
 * se ela reconectar. Um aviso por queda: só avisa de novo depois de voltar a conectar.
 * ponytail: temporizadores em memória — reiniciar a API recomeça a contagem (instância que segue fora
 * do ar avisa de novo 5 min após o boot); persistir o início da queda se isso incomodar.
 */
const createDownAlertWatcher = ({ delayMs = DOWN_ALERT_DELAY_MS, isStillDown, sendAlert }) => {
  const timers = new Map()
  const alerted = new Set()

  const fire = async (sessionId, since) => {
    timers.delete(sessionId)
    if (!isStillDown(sessionId)) return
    alerted.add(sessionId)
    try {
      await sendAlert(sessionId, since)
    } catch (error) {
      console.error(`[alerta] falha ao enviar aviso de instância fora do ar sessão=${sessionId}:`, error.message)
    }
  }

  return (sessionId, status) => {
    if (status === 'connected') {
      clearTimeout(timers.get(sessionId))
      timers.delete(sessionId)
      alerted.delete(sessionId)
      return
    }
    if (timers.has(sessionId) || alerted.has(sessionId)) return
    const since = new Date()
    const timer = setTimeout(() => fire(sessionId, since), delayMs)
    timer.unref?.()
    timers.set(sessionId, timer)
  }
}

const startInstanceDownAlerts = () => {
  const onStatus = createDownAlertWatcher({
    isStillDown: (sessionId) => getSessionStatus(sessionId) !== 'connected' && isSessionExpected(sessionId),
    sendAlert: sendDownAlert
  })
  subscribePanelEvents((event) => {
    if (event.type === 'status') onStatus(event.sessionId, event.status)
  })
  console.log(`[alerta] aviso de instância fora do ar ativo (após ${DOWN_ALERT_DELAY_MS / 60000} min)`)
}

module.exports = { startInstanceDownAlerts, createDownAlertWatcher, sendToTarget, DOWN_ALERT_DELAY_MS }
