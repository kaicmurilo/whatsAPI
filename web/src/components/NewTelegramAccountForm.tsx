import { useState, type FormEvent } from 'react'
import { useContinueTelegramLogin, useStartTelegramLogin } from '../hooks/useTelegramInstances'
import type { TelegramLoginStart } from '../lib/telegramApi'
import type { InstanceCreateFormProps } from '../types/components'

type LoginStep = 'credentials' | 'code' | 'password'

const EMPTY_CREDENTIALS: TelegramLoginStart = { phone: '', apiId: '', apiHash: '' }

const STEP_HINTS: Record<LoginStep, string> = {
  credentials: 'api_id e api_hash: my.telegram.org → API development tools',
  code: 'Código que o Telegram mandou (no app ou SMS)',
  password: 'Senha da verificação em duas etapas',
}

// Conta de usuário: telefone + credenciais do app → código → senha (se tiver duas etapas)
export function NewTelegramAccountForm({ onCreated }: InstanceCreateFormProps) {
  const [step, setStep] = useState<LoginStep>('credentials')
  const [credentials, setCredentials] = useState<TelegramLoginStart>(EMPTY_CREDENTIALS)
  const [loginId, setLoginId] = useState('')
  const [secret, setSecret] = useState('')
  const start = useStartTelegramLogin()
  const proceed = useContinueTelegramLogin()
  const activeError = step === 'credentials' ? start.error : proceed.error
  const isPending = start.isPending || proceed.isPending

  const restart = () => {
    setStep('credentials')
    setLoginId('')
    setSecret('')
  }

  const submitCredentials = () => start.mutate(credentials, {
    onSuccess: (result) => {
      setLoginId(result.loginId)
      setStep('code')
    },
  })

  const submitSecret = () => {
    const answer = step === 'code' ? { code: secret.trim() } : { password: secret }
    proceed.mutate({ loginId, answer }, {
      onSuccess: (result) => {
        setSecret('')
        if ('needs' in result) {
          setStep(result.needs)
          return
        }
        setCredentials(EMPTY_CREDENTIALS)
        restart()
        onCreated(result.instance.sessionId)
      },
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 'credentials') submitCredentials()
    else submitSecret()
  }

  const canSubmit = step === 'credentials'
    ? credentials.phone.trim() !== '' && credentials.apiId.trim() !== '' && credentials.apiHash.trim() !== ''
    : secret.trim() !== ''

  return (
    <form className="new-session__form" onSubmit={handleSubmit}>
      {step === 'credentials' ? (
        <>
          <input className="new-session__input" value={credentials.phone} onChange={(event) => setCredentials({ ...credentials, phone: event.target.value })} placeholder="telefone: 5511999998888" inputMode="tel" autoComplete="off" aria-label="Telefone da conta do Telegram" />
          <input className="new-session__input" value={credentials.apiId} onChange={(event) => setCredentials({ ...credentials, apiId: event.target.value })} placeholder="api_id" inputMode="numeric" autoComplete="off" aria-label="api_id" />
          <input className="new-session__input" type="password" value={credentials.apiHash} onChange={(event) => setCredentials({ ...credentials, apiHash: event.target.value })} placeholder="api_hash" autoComplete="off" spellCheck={false} aria-label="api_hash" />
        </>
      ) : (
        <input
          className="new-session__input"
          type={step === 'password' ? 'password' : 'text'}
          inputMode={step === 'code' ? 'numeric' : undefined}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder={step === 'code' ? 'código' : 'senha'}
          autoComplete="one-time-code"
          aria-label={STEP_HINTS[step]}
          autoFocus
        />
      )}
      <div className="new-session__row">
        <button type="submit" className="new-session__submit" disabled={!canSubmit || isPending}>
          {isPending ? '…' : step === 'credentials' ? 'Enviar código' : 'Entrar'}
        </button>
        {step === 'credentials' ? null : <button type="button" className="new-session__kind" onClick={restart}>Recomeçar</button>}
      </div>
      <p className="new-session__hint" role={activeError ? 'alert' : undefined}>{activeError ? activeError.message : STEP_HINTS[step]}</p>
    </form>
  )
}
