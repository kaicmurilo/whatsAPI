const { EventEmitter } = require('events')

const PANEL_EVENT = 'panel_event'

const panelEvents = new EventEmitter()
// Cada conexão SSE aberta registra um listener; o limite padrão (10) só geraria warning falso
panelEvents.setMaxListeners(0)

// ponytail: status só em memória — reinício do servidor volta tudo para "starting" até os eventos chegarem.
// A coluna whatsapp_sessions.status não é confiável hoje (nunca é atualizada).
const sessionStatuses = new Map()

const publishPanelEvent = (event) => panelEvents.emit(PANEL_EVENT, event)

const setSessionStatus = (sessionId, status) => {
  sessionStatuses.set(sessionId, status)
  publishPanelEvent({ type: 'status', sessionId, status })
}

const getSessionStatus = (sessionId) => sessionStatuses.get(sessionId) || 'starting'

const subscribePanelEvents = (listener) => {
  panelEvents.on(PANEL_EVENT, listener)
  return () => panelEvents.off(PANEL_EVENT, listener)
}

module.exports = { publishPanelEvent, setSessionStatus, getSessionStatus, subscribePanelEvents }
