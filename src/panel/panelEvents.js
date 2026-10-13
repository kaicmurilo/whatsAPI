const { EventEmitter } = require('events')
const { persistSessionStatus } = require('./sessionStatusRepository')

const PANEL_EVENT = 'panel_event'

const panelEvents = new EventEmitter()
// Cada conexão SSE aberta registra um listener; o limite padrão (10) só geraria warning falso
panelEvents.setMaxListeners(0)

// Fonte do status é a memória (eventos do WhatsApp); a coluna whatsapp_sessions.status é espelho gravado a cada mudança.
// ponytail: instância não restaurada após reinício mantém no banco o último status gravado (o painel mostra "stopped").
const sessionStatuses = new Map()

const publishPanelEvent = (event) => panelEvents.emit(PANEL_EVENT, event)

const setSessionStatus = (sessionId, status) => {
  sessionStatuses.set(sessionId, status)
  persistSessionStatus(sessionId, status)
  publishPanelEvent({ type: 'status', sessionId, status })
}

const getSessionStatus = (sessionId) => sessionStatuses.get(sessionId) || 'starting'

const subscribePanelEvents = (listener) => {
  panelEvents.on(PANEL_EVENT, listener)
  return () => panelEvents.off(PANEL_EVENT, listener)
}

module.exports = { publishPanelEvent, setSessionStatus, getSessionStatus, subscribePanelEvents }
