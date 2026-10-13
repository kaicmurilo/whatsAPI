import { useState, type FormEvent } from 'react'
import { useApiCredentials, useCreateApiCredential, useRevokeApiCredential } from '../hooks/useApiCredentials'
import { useSessions } from '../hooks/usePanelData'
import { formatDateTime } from '../lib/format'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { ApiCredential, CreatedApiCredential } from '../types/api'
import type { CreateApiCredentialFormProps, DataTableColumn, IssuedApiKeyProps, TablePaneProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { InstancePicker } from './InstancePicker'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const getCredentialKey = (credential: ApiCredential): string => credential.id

const instancesLabel = (credential: ApiCredential): string => (credential.sessionIds ? credential.sessionIds.join(', ') : 'Todas')

const lastUsedLabel = (credential: ApiCredential): string => (credential.lastUsedAt ? formatDateTime(credential.lastUsedAt) : 'Nunca')

function RevokeCredentialAction({ credential }: { credential: ApiCredential }) {
  const revoke = useRevokeApiCredential()
  return <ConfirmButton label="Revogar" confirmLabel="Confirmar revogação" isPending={revoke.isPending} onConfirm={() => revoke.mutate(credential.id)} />
}

const CREDENTIAL_COLUMNS: DataTableColumn<ApiCredential>[] = [
  { key: 'name', header: 'Aplicação', render: (credential) => <span className="files__name">{credential.name}</span> },
  { key: 'prefix', header: 'Chave', render: (credential) => <span className="broadcasts__mono">{credential.tokenPrefix}…</span> },
  { key: 'instances', header: 'Instâncias', render: (credential) => <span className="files__meta">{instancesLabel(credential)}</span> },
  { key: 'created', header: 'Criada em', render: (credential) => <span className="files__meta">{formatDateTime(credential.createdAt)}</span> },
  { key: 'used', header: 'Último uso', render: (credential) => <span className="files__meta">{lastUsedLabel(credential)}</span> },
  { key: 'actions', header: 'Ações', align: 'end', render: (credential) => <RevokeCredentialAction credential={credential} /> },
]

function IssuedApiKey({ credential, onDismiss }: IssuedApiKeyProps) {
  const [isCopied, setIsCopied] = useState(false)
  // ponytail: clipboard só existe em contexto seguro (https/localhost); fora disso o campo selecionável resolve
  const copyKey = () => navigator.clipboard?.writeText(credential.apiKey).then(() => setIsCopied(true), () => setIsCopied(false))

  return (
    <div className="credentials__issued" role="status">
      <p className="credentials__warning">
        Chave de <strong>{credential.name}</strong>. Copie agora: ela não aparece de novo. Perdeu? Revogue e crie outra.
      </p>
      <div className="credentials__key-row">
        <input className="field__input broadcasts__mono" readOnly value={credential.apiKey} aria-label="Chave da aplicação" onFocus={(event) => event.target.select()} />
        <button className="library__upload" type="button" onClick={copyKey}>{isCopied ? 'Copiada' : 'Copiar'}</button>
        <button className="credentials__dismiss" type="button" onClick={onDismiss}>Já copiei</button>
      </div>
      <p className="credentials__hint">Use como <code>Authorization: Bearer {credential.tokenPrefix}…</code> nas mesmas rotas do token.</p>
    </div>
  )
}

function CreateApiCredentialForm({ onCreated }: CreateApiCredentialFormProps) {
  const [name, setName] = useState('')
  const [sessionIds, setSessionIds] = useState<string[]>([])
  const sessions = useSessions()
  const create = useCreateApiCredential()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    create.mutate({ name: name.trim(), sessionIds: sessionIds.length > 0 ? sessionIds : null }, {
      onSuccess: (credential) => {
        setName('')
        setSessionIds([])
        onCreated(credential)
      },
    })
  }

  return (
    <form className="credentials__form" onSubmit={handleSubmit}>
      <div className="library__toolbar">
        <input
          className="field__input credentials__name"
          value={name}
          maxLength={60}
          required
          placeholder="Nome da aplicação (ex.: CRM)"
          aria-label="Nome da aplicação"
          onChange={(event) => setName(event.target.value)}
        />
        <button className="library__upload" type="submit" disabled={create.isPending}>{create.isPending ? 'Criando…' : '+ Criar credencial'}</button>
      </div>
      <InstancePicker
        sessions={sessions.data ?? []}
        selectedIds={sessionIds}
        onChange={setSessionIds}
        allowDisconnected
        isDisabled={create.isPending}
        legend="Instâncias liberadas"
      />
      <p className="credentials__hint">Nada marcado libera todas, inclusive as que você criar depois. Marcando, a chave só usa as rotas dessas instâncias.</p>
      {create.isError ? <p className="contacts__error" role="alert">{create.error.message}</p> : null}
    </form>
  )
}

export function CredentialsPane({ page, search, onPageChange, onSearchChange }: TablePaneProps) {
  const credentials = useApiCredentials({ page, search })
  const [issued, setIssued] = useState<CreatedApiCredential | null>(null)
  const items = credentials.data?.items ?? []

  return (
    <section className="library" aria-labelledby="credentials-title">
      <header className="library__header">
        <p className="library__eyebrow">Integrações</p>
        <h1 id="credentials-title" className="library__title">Credenciais de API</h1>
        <p className="library__note">Uma chave por aplicação. Ela age como a sua conta nas rotas da API; revogar corta o acesso na hora.</p>
      </header>

      <CreateApiCredentialForm onCreated={setIssued} />
      {issued ? <IssuedApiKey credential={issued} onDismiss={() => setIssued(null)} /> : null}

      <div className="library__toolbar">
        <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar pelo nome" label="Buscar credenciais" />
      </div>

      {credentials.isError ? <EmptyState title="Não foi possível carregar as credenciais">{credentials.error.message}</EmptyState> : null}
      {credentials.isSuccess && items.length === 0 ? (
        <EmptyState title={search ? 'Nenhuma credencial encontrada' : 'Nenhuma credencial criada'}>
          {search ? null : 'Crie uma para cada sistema que vai consumir a API, assim dá para revogar um sem afetar os outros.'}
        </EmptyState>
      ) : null}
      {items.length > 0 ? <DataTable caption="Credenciais de API" columns={CREDENTIAL_COLUMNS} rows={items} getRowKey={getCredentialKey} isBusy={credentials.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={credentials.data?.total ?? 0} label="Paginação das credenciais" onPageChange={onPageChange} />
    </section>
  )
}
