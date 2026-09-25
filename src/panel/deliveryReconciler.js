const { listRecipientsToReconcile, listRecentRunIds, applyDeliveryTimes } = require('./deliveryRepository')
const { publishPanelEvent } = require('./panelEvents')

const RECENT_RUNS_DAYS = 7

/* global window */
// Mesma consulta da tela "Dados da mensagem" do WhatsApp (Message.getInfo do wwebjs), mas devolvendo
// só os horários: os ContactId não sobrevivem à serialização e não são necessários.
const readMessageInfoInPage = async (messageId) => {
  const { Msg } = window.require('WAWebCollections')
  const msg = Msg.get(messageId) || (await Msg.getMessagesById([messageId]))?.messages?.[0]
  if (!msg || !msg.id.fromMe) return null
  const info = await window.require('WAWebApiMessageInfoStore').queryMsgInfo(msg.id)
  const times = (entries) => (entries || []).map((entry) => entry.t).filter(Boolean)
  return { delivery: times(info?.delivery), read: times(info?.read), played: times(info?.played) }
}

// Conversa individual: um só destinatário, mas pega o menor por segurança
const earliestDate = (seconds) => (seconds && seconds.length > 0 ? new Date(Math.min(...seconds) * 1000) : null)

const toDeliveryTimes = (info) => ({
  deliveredAt: earliestDate(info.delivery),
  readAt: earliestDate(info.read),
  playedAt: earliestDate(info.played)
})

/**
 * Busca o status atual (entregue/lido/reproduzido, com horário real) das mensagens do disparo.
 * Recupera tiques que chegaram com a instância desligada ou antes do rastreio existir.
 * Só leitura no WhatsApp — nada é enviado.
 * @returns {{ checked: number, updated: number, failed: number }}
 */
const reconcileRunDeliveries = async (client, runId) => {
  const recipients = await listRecipientsToReconcile(runId)
  // withoutInfo: o WhatsApp não devolveu "Dados da mensagem" (mensagem fora do cache/consulta indisponível)
  const summary = { checked: recipients.length, updated: 0, failed: 0, withoutInfo: 0, readSeen: 0 }
  for (const recipient of recipients) {
    try {
      const info = await client.pupPage.evaluate(readMessageInfoInPage, recipient.messageId)
      if (!info) {
        summary.withoutInfo++
        continue
      }
      if (info.read.length > 0) summary.readSeen++
      if (await applyDeliveryTimes({ runId, position: recipient.position, ...toDeliveryTimes(info) })) summary.updated++
    } catch (error) {
      summary.failed++
      console.warn(`[panel] falha ao consultar tiques run=${runId} posição=${recipient.position}:`, error.message)
    }
  }
  return summary
}

// Ao conectar: concilia os disparos recentes da instância (fire-and-forget, loga o resultado)
const reconcileRecentRuns = async (sessionId, client) => {
  try {
    const runIds = await listRecentRunIds(sessionId, RECENT_RUNS_DAYS)
    for (const runId of runIds) {
      const summary = await reconcileRunDeliveries(client, runId)
      if (summary.updated > 0) publishPanelEvent({ type: 'broadcast_delivery', sessionId, runId })
      if (summary.checked > 0) {
        console.log(`[panel] tiques conciliados run=${runId} verificados=${summary.checked} com_leitura=${summary.readSeen} sem_dados=${summary.withoutInfo} atualizados=${summary.updated} falhas=${summary.failed}`)
      }
    }
  } catch (error) {
    console.error(`[panel] falha na conciliação de tiques sessão=${sessionId}:`, error.message)
  }
}

module.exports = { reconcileRunDeliveries, reconcileRecentRuns, toDeliveryTimes }
