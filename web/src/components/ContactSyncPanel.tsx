import { useState, type FormEvent } from 'react'
import { useContactSync, useStartContactSync } from '../hooks/useContacts'
import type { ContactSyncInput } from '../types/api'
import type { ContactSyncPanelProps, ContactSyncScope } from '../types/components'
import { ContactSyncProgress } from './ContactSyncProgress'
import { InstancePicker } from './InstancePicker'

// Mesmo teto do servidor: "Todos" salva no máximo os primeiros 5.000 da busca
const MAX_SYNC_CONTACTS = 5000

interface SyncChoice {
  sessionIds: string[]
  scope: ContactSyncScope
  selectedIds: string[]
  search: string
  syncToPhone: boolean
}

function buildSyncInput({ sessionIds, scope, selectedIds, search, syncToPhone }: SyncChoice): ContactSyncInput {
  if (scope === 'all') return { sessionIds, syncToPhone, all: true, search }
  return { sessionIds, syncToPhone, contactIds: selectedIds }
}

function contactCountOf(scope: ContactSyncScope, selectedCount: number, matchingCount: number): number {
  return scope === 'all' ? Math.min(matchingCount, MAX_SYNC_CONTACTS) : selectedCount
}

export function ContactSyncPanel({ sessions, selectedIds, matchingCount, search, onClearSelection, onClose }: ContactSyncPanelProps) {
  const [sessionIds, setSessionIds] = useState<string[]>([])
  const [scope, setScope] = useState<ContactSyncScope>('selected')
  const [syncToPhone, setSyncToPhone] = useState(false)
  const sync = useContactSync()
  const startSync = useStartContactSync()

  const job = sync.data ?? null
  const isRunning = job?.status === 'running'
  const contactCount = contactCountOf(scope, selectedIds.length, matchingCount)
  const canStart = sessionIds.length > 0 && contactCount > 0 && !isRunning && !startSync.isPending
  const allLabel = search ? `Todos da busca (${matchingCount})` : `Todos (${matchingCount})`

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canStart) return
    startSync.mutate(buildSyncInput({ sessionIds, scope, selectedIds, search, syncToPhone }), { onSuccess: onClearSelection })
  }

  return (
    <form className="contact-sync" onSubmit={handleSubmit} aria-labelledby="contact-sync-title">
      <header className="contact-sync__header">
        <h2 id="contact-sync-title" className="contact-sync__title">Sincronizar com WhatsApp</h2>
        <button type="button" className="contact-sync__close" onClick={onClose}>Fechar</button>
      </header>

      <InstancePicker
        sessions={sessions}
        selectedIds={sessionIds}
        onChange={setSessionIds}
        allowDisconnected={false}
        isDisabled={isRunning}
        legend="Salvar nas instâncias"
      />

      <fieldset className="contact-sync__scope" disabled={isRunning}>
        <legend className="field__label">Contatos</legend>
        <label className="instance-picker__option">
          <input type="radio" name="contact-sync-scope" checked={scope === 'selected'} onChange={() => setScope('selected')} />
          <span>Selecionados na tabela ({selectedIds.length})</span>
        </label>
        <label className="instance-picker__option">
          <input type="radio" name="contact-sync-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
          <span>{allLabel}</span>
        </label>
        {scope === 'all' && matchingCount > MAX_SYNC_CONTACTS ? (
          <p className="contact-sync__hint">Salva os primeiros {MAX_SYNC_CONTACTS.toLocaleString('pt-BR')} em ordem alfabética.</p>
        ) : null}
      </fieldset>

      <label className="instance-picker__option">
        <input type="checkbox" checked={syncToPhone} disabled={isRunning} onChange={(event) => setSyncToPhone(event.target.checked)} />
        <span>Também salvar na agenda do celular</span>
      </label>

      <button type="submit" className="contact-form__submit" disabled={!canStart}>
        {startSync.isPending ? 'Iniciando…' : `Salvar ${contactCount} no WhatsApp`}
      </button>
      <p className="contact-form__feedback">Cada instância salva um contato por vez, com pausa de 1 a 3 s, e as instâncias rodam juntas. Quem já está salvo na conta é pulado.</p>
      {startSync.isError ? <p className="contact-sync__error" role="alert">{startSync.error.message}</p> : null}
      {job ? <ContactSyncProgress job={job} /> : null}
    </form>
  )
}
