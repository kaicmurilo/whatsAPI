const TOKEN_KEY = 'whatsapi.accessToken'
const CREDENTIALS_KEY = 'whatsapi.savedCredentials'

type SavedCredentials = {
  userId: string
  userSecret: string
}

// ponytail: sessionStorage (escopo da aba, some ao fechar) porque a API só aceita Bearer.
// Ainda é legível por XSS — o fim de linha é a API emitir cookie httpOnly + SameSite.
// User id e secret só vão para localStorage se a pessoa marcar "Salvar neste navegador".
export function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // storage bloqueado: login vale só enquanto a página estiver aberta
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // nada a limpar
  }
}

function isSavedCredentials(value: unknown): value is SavedCredentials {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.userId === 'string' && typeof record.userSecret === 'string' && record.userId.length > 0 && record.userSecret.length > 0
}

export function readSavedCredentials(): SavedCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSavedCredentials(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function storeSavedCredentials(userId: string, userSecret: string): void {
  try {
    const payload: SavedCredentials = { userId, userSecret }
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(payload))
  } catch {
    // storage bloqueado: o formulário segue só nesta visita
  }
}

export function clearSavedCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_KEY)
  } catch {
    // nada a limpar
  }
}
