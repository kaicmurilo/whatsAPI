import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'

export function LoginPage() {
  const { login } = useAuth()
  const [userId, setUserId] = useState('')
  const [userSecret, setUserSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await login(userId.trim(), userSecret)
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

        {error ? <p className="login__error" role="alert">{error}</p> : null}

        <button type="submit" className="login__submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
