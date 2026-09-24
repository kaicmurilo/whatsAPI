import { useState, type FormEvent } from 'react'
import { useSaveContact } from '../hooks/useContacts'

const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15

const countDigits = (value: string): number => value.replace(/\D/g, '').length

export function ContactForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const saveContact = useSaveContact()
  const phoneDigits = countDigits(phone)
  const isValid = name.trim().length > 0 && phoneDigits >= MIN_PHONE_DIGITS && phoneDigits <= MAX_PHONE_DIGITS

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValid) return
    saveContact.mutate(
      { name: name.trim(), phone },
      {
        onSuccess: () => {
          setName('')
          setPhone('')
        },
      },
    )
  }

  const feedback = saveContact.isError
    ? saveContact.error.message
    : saveContact.isSuccess
      ? `${saveContact.data.name} salvo na agenda.`
      : 'Mesmo telefone de novo atualiza o nome.'

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field__label">Nome</span>
        <input className="field__input" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="off" required />
      </label>
      <label className="field">
        <span className="field__label">Telefone com DDI</span>
        <input
          className="field__input"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="55 11 99999-8888"
          inputMode="tel"
          autoComplete="off"
          required
        />
      </label>
      <button type="submit" className="contact-form__submit" disabled={!isValid || saveContact.isPending}>
        {saveContact.isPending ? 'Salvando…' : 'Adicionar contato'}
      </button>
      <p className="contact-form__feedback" role={saveContact.isError ? 'alert' : 'status'}>{feedback}</p>
    </form>
  )
}
