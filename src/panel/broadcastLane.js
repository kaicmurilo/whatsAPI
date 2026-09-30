// Fila global: um envio por vez em todo o processo. O próximo (outra instância ou outra lista)
// só começa depois do intervalo de quem acabou de enviar — instâncias diferentes não disparam juntas.
// Cada instância ainda tem a própria fila: um contato por vez e o mesmo intervalo antes de repetir o número.

const lanes = new Map()

const createLane = () => {
  let holder = null
  let lastRunId = null
  let blockedUntil = 0
  let timer = null
  const waiters = []

  const pump = () => {
    if (holder) return
    const now = Date.now()
    if (now < blockedUntil) {
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          pump()
        }, blockedUntil - now)
      }
      return
    }
    if (waiters.length === 0) return
    const other = waiters.findIndex((waiter) => waiter.runId !== lastRunId)
    const index = other === -1 ? 0 : other
    const [waiter] = waiters.splice(index, 1)
    holder = waiter.runId
    lastRunId = waiter.runId
    waiter.signal?.removeEventListener('abort', waiter.onAbort)
    waiter.resolve(true)
  }

  return {
    snapshot () {
      return { waiting: waiters.length, busy: holder !== null, blockedUntil }
    },
    acquire(runId, signal) {
      if (signal?.aborted) return Promise.resolve(false)
      return new Promise((resolve) => {
        const waiter = { runId, resolve, signal }
        waiter.onAbort = () => {
          const index = waiters.indexOf(waiter)
          if (index !== -1) waiters.splice(index, 1)
          resolve(false)
        }
        signal?.addEventListener('abort', waiter.onAbort, { once: true })
        waiters.push(waiter)
        pump()
      })
    },
    release(delayMs) {
      holder = null
      blockedUntil = Date.now() + Math.max(0, delayMs)
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pump()
    }
  }
}

const laneFor = (sessionId) => {
  let lane = lanes.get(sessionId)
  if (!lane) {
    lane = createLane()
    lanes.set(sessionId, lane)
  }
  return lane
}

const sendSlot = createLane()

const acquireSession = (sessionId, runId, signal) => laneFor(sessionId).acquire(runId, signal)

const releaseSession = (sessionId, delayMs) => laneFor(sessionId).release(delayMs)

const acquireSendSlot = (runId, signal) => sendSlot.acquire(runId, signal)

const releaseSendSlot = (delayMs) => sendSlot.release(delayMs)

const sendQueueSnapshot = () => {
  const { waiting, busy, blockedUntil } = sendSlot.snapshot()
  const now = Date.now()
  return {
    queued: waiting,
    sending: busy,
    nextSendAt: blockedUntil > now ? new Date(blockedUntil).toISOString() : null
  }
}

module.exports = { acquireSession, releaseSession, acquireSendSlot, releaseSendSlot, sendQueueSnapshot }
