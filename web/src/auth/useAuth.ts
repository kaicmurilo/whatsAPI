import { useContext } from 'react'
import { AuthContext, type AuthState } from './AuthContext'

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return auth
}

// Para telas que só renderizam logado — evita checar null em cada hook de dados
export function useRequiredToken(): string {
  const { token } = useAuth()
  if (!token) throw new Error('Token ausente: tela protegida renderizada sem login')
  return token
}
