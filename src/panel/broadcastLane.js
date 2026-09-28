// Uma instância envia um contato por vez. Várias listas na mesma instância alternam a vez
// e respeitam o intervalo de quem acabou de enviar — o ritmo da instância não dobra.

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
    ready: () => holder === null && Date.now() >= blockedUntil && waiters.length === 0,
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

const acquireSession = (sessionId, runId, signal) => laneFor(sessionId).acquire(runId, signal)

const releaseSession = (sessionId, delayMs) => laneFor(sessionId).release(delayMs)

const sessionReady = (sessionId) => laneFor(sessionId).ready()

module.exports = { acquireSession, releaseSession, sessionReady }
