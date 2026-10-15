import { useGroupCacheStatus, useGroups, useRefreshGroups } from '../hooks/useGroups'
import { formatDateTime } from '../lib/format'
import { describeAdmin } from '../lib/groupLabels'
import { TABLE_PER_PAGE } from '../lib/panelApi'
import type { WhatsAppGroup, WhatsAppSession } from '../types/api'
import type { DataTableColumn, GroupsPaneProps } from '../types/components'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { GroupAddInstances } from './GroupAddInstances'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const ADMINS_SHOWN = 3

const getGroupKey = (group: WhatsAppGroup): string => group.chatId

const adminsLabel = (group: WhatsAppGroup): string => {
  if (group.admins.length === 0) return '—'
  const shown = group.admins.slice(0, ADMINS_SHOWN).map(describeAdmin).join(', ')
  return group.admins.length > ADMINS_SHOWN ? `${shown} +${group.admins.length - ADMINS_SHOWN}` : shown
}

const myInstancesLabel = (group: WhatsAppGroup): string =>
  group.memberSessionIds.map((sessionId) => (group.adminSessionIds.includes(sessionId) ? `${sessionId} (admin)` : sessionId)).join(', ')

const groupColumns = (sessions: WhatsAppSession[]): DataTableColumn<WhatsAppGroup>[] => [
  {
    key: 'name',
    header: 'Grupo',
    render: (group) => (
      <span className="dash-instance">
        <span className="files__name">{group.name || 'Sem nome'}</span>
        <span className="dash-instance__id">{group.chatId}</span>
      </span>
    ),
  },
  { key: 'size', header: 'Participantes', align: 'end', render: (group) => group.participantsCount.toLocaleString('pt-BR') },
  { key: 'admins', header: 'Admins', render: (group) => <span className="groups__list">{adminsLabel(group)}</span> },
  { key: 'mine', header: 'Minhas instâncias', render: (group) => <span className="groups__list">{myInstancesLabel(group)}</span> },
  { key: 'actions', header: 'Ações', render: (group) => <GroupAddInstances group={group} sessions={sessions} /> },
]

export function GroupsPane({ sessions, page, search, onPageChange, onSearchChange }: GroupsPaneProps) {
  const groups = useGroups({ page, search }, TABLE_PER_PAGE)
  const status = useGroupCacheStatus()
  const refresh = useRefreshGroups()
  const items = groups.data?.items ?? []
  const refreshedAt = status.data?.refreshedAt

  return (
    <section className="library" aria-labelledby="groups-title">
      <header className="library__header">
        <p className="library__eyebrow">WhatsApp</p>
        <h1 id="groups-title" className="library__title">Grupos</h1>
        <p className="library__note">
          Grupos em que suas instâncias estão. O cache vale 24h e é atualizado sozinho a cada hora e quando uma instância conecta.
          {refreshedAt ? ` Última atualização: ${formatDateTime(refreshedAt)}.` : ' Ainda não atualizado.'}
        </p>
      </header>

      <div className="library__toolbar">
        <SearchInput value={search} onSearchChange={onSearchChange} placeholder="Buscar pelo nome ou id" label="Buscar grupos" />
        <button className="library__upload" type="button" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          {refresh.isPending ? 'Atualizando…' : 'Atualizar agora'}
        </button>
      </div>
      {refresh.isError ? <p className="contacts__error" role="alert">{refresh.error.message}</p> : null}

      {groups.isError ? <EmptyState title="Não foi possível carregar os grupos">{groups.error.message}</EmptyState> : null}
      {groups.isSuccess && items.length === 0 ? (
        <EmptyState title={search ? 'Nenhum grupo encontrado' : 'Nenhum grupo no cache'}>
          {search ? null : 'Conecte uma instância ou clique em Atualizar agora.'}
        </EmptyState>
      ) : null}
      {items.length > 0 ? <DataTable caption="Grupos das instâncias" columns={groupColumns(sessions)} rows={items} getRowKey={getGroupKey} isBusy={groups.isFetching} /> : null}
      <Pagination page={page} perPage={TABLE_PER_PAGE} total={groups.data?.total ?? 0} label="Paginação dos grupos" onPageChange={onPageChange} />
    </section>
  )
}
