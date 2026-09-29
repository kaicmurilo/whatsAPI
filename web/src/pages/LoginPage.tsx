import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { clearSavedCredentials, readSavedCredentials, storeSavedCredentials } from '../lib/authStorage'

function initialLoginForm() {
  const saved = readSavedCredentials()
  return {
    userId: saved?.userId ?? '',
    userSecret: saved?.userSecret ?? '',
    remember: saved !== null,
  }
}

export function LoginPage() {
  const { login } = useAuth()
  const [form] = useState(initialLoginForm)
  const [userId, setUserId] = useState(form.userId)
  const [userSecret, setUserSecret] = useState(form.userSecret)
  const [remember, setRemember] = useState(form.remember)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    const trimmedUserId = userId.trim()
    if (remember) storeSavedCredentials(trimmedUserId, userSecret)
    else clearSavedCredentials()
    try {
      await login(trimmedUserId, userSecret)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha no login')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <p className="login__eyebrow">WhatsAPI</p>
        <h1 className="login__title">Central de instâncias</h1>

        <label className="field">
          <span className="field__label">User ID</span>
          <input className="field__input" value={userId} onChange={(event) => setUserId(event.target.value)} autoComplete="username" required spellCheck={false} />
        </label>
        <label className="field">
          <span className="field__label">Secret</span>
          <input className="field__input" type="password" value={userSecret} onChange={(event) => setUserSecret(event.target.value)} autoComplete="current-password" required />
        </label>

        <label className="login__remember">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>Salvar user id e secret neste navegador</span>
        </label>

        {error ? <p className="login__error" role="alert">{error}</p> : null}

        <button type="submit" className="login__submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
