import { useContacts } from '../hooks/useContacts'
import { useResolveChat } from '../hooks/useMessaging'
import { formatPhone } from '../lib/format'
import { CONTACTS_PER_PAGE } from '../lib/panelApi'
import type { Contact } from '../types/api'
import type { ContactsPaneProps, DataTableColumn } from '../types/components'
import { ContactForm } from './ContactForm'
import { ContactRowActions } from './ContactRowActions'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const getContactKey = (contact: Contact): string => contact.id

export function ContactsPane({ session, page, search, onPageChange, onSearchChange, onOpenChat }: ContactsPaneProps) {
  const contacts = useContacts({ page, search })
  const resolveChat = useResolveChat()
  const canChat = session?.status === 'connected'

  const handleChat = (contact: Contact) => {
    if (!session) return
    resolveChat.mutate({ sessionId: session.sessionId, phone: contact.phone }, { onSuccess: onOpenChat })
  }

  const columns: DataTableColumn<Contact>[] = [
    { key: 'name', header: 'Nome', render: (contact) => <span className="contacts__name">{contact.name}</span> },
    { key: 'phone', header: 'Telefone', render: (contact) => <span className="contacts__phone">{formatPhone(contact.phone)}</span> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'end',
      render: (contact) => (
        <ContactRowActions
          contact={contact}
          canChat={canChat}
          isResolving={resolveChat.isPending && resolveChat.variables?.phone === contact.phone}
          onChat={handleChat}
        />
      ),
    },
  ]

  const items = contacts.data?.items ?? []
  const chatTarget = session ? `Conversas abrem na instância ${session.pushName ?? session.sessionId}.` : 'Selecione uma instância para conversar com um contato.'

  return (
    <section className="contacts" aria-labelledby="contacts-title">
      <header className="contacts__header">
        <p className="contacts__eyebrow">Agenda do painel</p>
        <h1 id="contacts-title" className="contacts__title">Contatos</h1>
        <p className="contacts__note">Salvos só aqui — não alteram a agenda do celular. {chatTarget}</p>
      </header>

      <div className="contacts__layout">
        <ContactForm />

        <div className="contacts__list">
          <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar por nome ou telefone" label="Buscar contatos" />
          {resolveChat.isError ? <p className="contacts__error" role="alert">{resolveChat.error.message}</p> : null}
          {contacts.isError ? <EmptyState title="Não foi possível carregar os contatos">{contacts.error.message}</EmptyState> : null}
          {contacts.isSuccess && items.length === 0 ? (
            <EmptyState title={search ? 'Nenhum contato encontrado' : 'Agenda vazia'}>
              {search ? null : 'Adicione o primeiro contato no formulário.'}
            </EmptyState>
          ) : null}
          {items.length > 0 ? (
            <DataTable caption="Contatos da agenda" columns={columns} rows={items} getRowKey={getContactKey} isBusy={contacts.isFetching} />
          ) : null}
          <Pagination page={page} perPage={CONTACTS_PER_PAGE} total={contacts.data?.total ?? 0} label="Paginação dos contatos" onPageChange={onPageChange} />
        </div>
      </div>
    </section>
  )
}
