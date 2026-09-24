import { useAuth } from './auth/useAuth'
import { LoginPage } from './pages/LoginPage'
import { PanelPage } from './pages/PanelPage'

export function App() {
  const { token } = useAuth()
  return token ? <PanelPage /> : <LoginPage />
}
