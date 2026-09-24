import { createContext } from 'react'

export interface AuthState {
  token: string | null
  login: (userId: string, userSecret: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)
