import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AUTH_EXPIRED_EVENT } from '../lib/apiClient'
import { clearStoredToken, readStoredToken, storeToken } from '../lib/authStorage'
import { authenticate } from '../lib/panelApi'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(readStoredToken)

  const logout = useCallback(() => {
    clearStoredToken()
    queryClient.clear()
    setToken(null)
  }, [queryClient])

  const login = useCallback(async (userId: string, userSecret: string) => {
    const tokens = await authenticate(userId, userSecret)
    storeToken(tokens.access_token)
    setToken(tokens.access_token)
  }, [])

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout)
  }, [logout])

  const value = useMemo<AuthState>(() => ({ token, login, logout }), [token, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
