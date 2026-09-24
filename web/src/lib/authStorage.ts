const TOKEN_KEY = 'whatsapi.accessToken'

// ponytail: sessionStorage (escopo da aba, some ao fechar) porque a API só aceita Bearer.
// Ainda é legível por XSS — o fim de linha é a API emitir cookie httpOnly + SameSite.
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
