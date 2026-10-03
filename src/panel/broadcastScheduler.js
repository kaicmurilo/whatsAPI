const { sessionsOf } = require('./broadcastSessions')
const { listDueScheduledRuns, listPolicyPausedRuns } = require('./broadcastRunRepository')
const { decideScheduledAction, LATE_GRACE_MS } = require('./broadcastSchedule')
const broadcastService = require('./broadcastService')
const { channelNamed } = require('./broadcastChannels')

const TICK_MS = 30 * 1000
const LATE_GRACE_MINUTES = LATE_GRACE_MS / 60000

let isTicking = false

const handleDueRun = async (run, now) => {
  const channel = channelNamed(run.channel)
  const isConnected = await channel.isReady(run.userId, sessionsOf(run), { all: true })
  const action = decideScheduledAction({ scheduledAt: run.scheduledAt, now, isConnected })
  if (action === 'start') return broadcastService.startScheduled(run)
  if (action === 'expire') {
    return broadcastService.failScheduled(run, `${channel.notReadyReason} no horário programado (esperou ${LATE_GRACE_MINUTES} min)`)
  }
}

// Um tick por vez: um tick lento (validateSession, montagem da lista) nunca se sobrepõe ao próximo
const tick = async () => {
  if (isTicking) return
  isTicking = true
  try {
    const now = new Date()
    for (const run of await listDueScheduledRuns(now)) {
      try {
        await handleDueRun(run, now)
      } catch (error) {
        console.error(`[panel] falha no agendador run=${run.id}:`, error.message)
      }
    }
    for (const run of await listPolicyPausedRuns()) {
      try {
        await broadcastService.resumePolicyPause(run)
      } catch (error) {
        console.error(`[panel] falha ao retomar disparo run=${run.id}:`, error.message)
      }
    }
  } catch (error) {
    console.error('[panel] falha ao consultar disparos programados:', error.message)
  } finally {
    isTicking = false
  }
}

/**
 * Agendador dentro da API: programados ficam no Postgres, então sobrevivem a reinícios.
 * ponytail: setInterval num processo só — vale para uma réplica (Docker local); com várias réplicas o claim
 * atômico ainda impede disparo duplo, mas todas fariam a consulta.
 */
const startBroadcastScheduler = () => {
  setInterval(tick, TICK_MS).unref()
  tick()
  console.log(`[panel] agendador de disparos ativo (verifica a cada ${TICK_MS / 1000}s)`)
}

module.exports = { startBroadcastScheduler }
