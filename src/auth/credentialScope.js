// Credencial de API pode ser restrita a algumas instâncias; JWT do painel e credencial sem lista veem todas
const isRestrictedCredential = (token) => Array.isArray(token?.allowedSessionIds)

const isSessionAllowed = (token, sessionId) => !isRestrictedCredential(token) || token.allowedSessionIds.includes(sessionId)

// Instâncias liberadas da credencial; null = sem restrição
const allowedSessionsOf = (token) => (isRestrictedCredential(token) ? token.allowedSessionIds : null)

module.exports = { isRestrictedCredential, isSessionAllowed, allowedSessionsOf }
