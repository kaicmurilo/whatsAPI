const { groupRefreshMinutes } = require('../config')
const { sessions } = require('../sessions')
const { getConnectedClient } = require('./broadcastChannels')
const { subscribePanelEvents } = require('./panelEvents')
const { readGroups } = require('./groupMembership')
const { replaceSessionGroups, deleteExpiredGroups } = require('./groupCacheRepository')

// Logo após conectar o WhatsApp Web ainda carrega os chats: espera antes de ler
const AFTER_CONNECT_DELAY_MS = 60 * 1000

const inFlight = new Map()

/**
 * Atualiza o retrato dos grupos de uma instância conectada. Uma por vez por instância.
 * Leitura que falha não apaga nada: o cache segue válido até expirar.
 */
const refreshSessionGroups = (sessionId) => {
  if (inFlight.has(sessionId)) return inFlight.get(sessionId)
  const run = (async () => {
    const client = getConnectedClient(sessionId)
    if (!client) return null
    const startedAt = new Date()
    const groups = await readGroups(client, sessionId)
    if (!groups) return null
    const result = await replaceSessionGroups(sessionId, groups, startedAt)
    console.log(`[grupos] cache atualizado sessão=${sessionId} grupos=${result.saved} saiu_de=${result.removed} em ${Date.now() - startedAt.getTime()}ms`)
    return result
  })()
    .catch((error) => {
      console.error(`[grupos] falha ao atualizar cache sessão=${sessionId}:`, error.message)
      return null
    })
    .finally(() => inFlight.delete(sessionId))
  inFlight.set(sessionId, run)
  return run
}

// Em sequência: cada leitura usa o navegador da instância, não vale abrir todas ao mesmo tempo
const refreshSessions = async (sessionIds) => {
  for (const sessionId of sessionIds) await refreshSessionGroups(sessionId)
}

const refreshAll = async () => {
  await refreshSessions([...sessions.keys()].filter((sessionId) => getConnectedClient(sessionId)))
  const expired = await deleteExpiredGroups().catch((error) => {
    console.error('[grupos] falha ao expirar cache:', error.message)
    return 0
  })
  if (expired > 0) console.log(`[grupos] ${expired} retrato(s) com mais de 24h removido(s) do cache`)
}

const startGroupCache = () => {
  subscribePanelEvents((event) => {
    if (event.type === 'status' && event.status === 'connected') {
      setTimeout(() => refreshSessionGroups(event.sessionId), AFTER_CONNECT_DELAY_MS).unref?.()
    }
  })
  setInterval(refreshAll, groupRefreshMinutes * 60 * 1000).unref()
  console.log(`[grupos] cache de grupos ativo (atualiza a cada ${groupRefreshMinutes} min e ao conectar; expira em 24h)`)
}

module.exports = { startGroupCache, refreshSessionGroups, refreshSessions }
