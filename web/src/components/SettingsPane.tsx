import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDeleteSuppressed, useSaveSettings, useSettings, useSuppressed } from '../hooks/useSettings'
import { formatDateTime, formatPhone } from '../lib/format'
import { SUPPRESSION_PER_PAGE } from '../lib/settingsApi'
import type { PanelSettings, SuppressedNumber } from '../types/api'
import type { DataTableColumn } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { SearchInput } from './SearchInput'

const DAILY_CAP_MIN = 20
const DAILY_CAP_MAX = 400

const keywordTextOf = (keywords: string[]): string => keywords.join('\n')

const keywordsOf = (text: string): string[] => text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 0)

export function SettingsPane() {
  const settings = useSettings()
  const save = useSaveSettings()
  const [draft, setDraft] = useState<PanelSettings | null>(null)
  const [keywordText, setKeywordText] = useState('')
  const seeded = useRef(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const suppressed = useSuppressed({ page, search })
  const remove = useDeleteSuppressed()

  useEffect(() => {
    if (!settings.data || seeded.current) return
    seeded.current = true
    setDraft(settings.data)
    setKeywordText(keywordTextOf(settings.data.suppressionKeywords))
  }, [settings.data])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    const dailyCap = Math.min(DAILY_CAP_MAX, Math.max(DAILY_CAP_MIN, Math.trunc(draft.dailyCap)))
    save.mutate(
      { ...draft, dailyCap, suppressionKeywords: keywordsOf(keywordText) },
      {
        onSuccess: (saved) => {
          setDraft(saved)
          setKeywordText(keywordTextOf(saved.suppressionKeywords))
        },
      },
    )
  }

  const columns: DataTableColumn<SuppressedNumber>[] = [
    { key: 'phone', header: 'Telefone', render: (row) => <span className="contacts__phone">{formatPhone(row.phone)}</span> },
    { key: 'keyword', header: 'Palavra', render: (row) => row.keyword },
    { key: 'when', header: 'Quando pediu', render: (row) => <span className="broadcasts__mono">{formatDateTime(row.requestedAt)}</span> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'end',
      render: (row) => (
        <ConfirmButton
          label="Remover"
          confirmLabel="Confirmar"
          isPending={remove.isPending && remove.variables === row.id}
          onConfirm={() => remove.mutate(row.id)}
        />
      ),
    },
  ]

  const items = suppressed.data?.items ?? []

  return (
    <section className="settings" aria-labelledby="settings-title">
      <header className="contacts__header">
        <p className="contacts__eyebrow">Conta</p>
        <h1 id="settings-title" className="contacts__title">Configurações</h1>
        <p className="contacts__note">Vale para todas as instâncias. Supressão e dedup protegem o número; o restante só entra quando você liga.</p>
      </header>

      {settings.isError ? <EmptyState title="Não foi possível carregar">{settings.error.message}</EmptyState> : null}

      {draft ? (
        <form className="settings__form" onSubmit={handleSubmit}>
          <fieldset className="settings__section">
            <legend className="settings__legend">Supressão</legend>
            <label className="settings__toggle">
              <input
                type="checkbox"
                checked={draft.suppressionEnabled}
                onChange={(event) => setDraft({ ...draft, suppressionEnabled: event.target.checked })}
              />
              <span>Não enviar para quem mandar uma destas palavras sozinha. Ligado por padrão.</span>
            </label>
            <label className="field">
              <span className="field__label">Palavras, uma por linha</span>
              <textarea
                className="field__input"
                rows={4}
                value={keywordText}
                onChange={(event) => setKeywordText(event.target.value)}
                spellCheck={false}
              />
            </label>
            <p className="settings__hint">A mensagem inteira precisa ser a palavra. “Não quero sair da consulta” não entra na lista.</p>
          </fieldset>

          <fieldset className="settings__section">
            <legend className="settings__legend">Durante o disparo</legend>
            <label className="settings__toggle">
              <input
                type="checkbox"
                checked={draft.stopOnReply}
                onChange={(event) => setDraft({ ...draft, stopOnReply: event.target.checked })}
              />
              <span>Tirar da fila quem responder antes de receber. Só aquele contato, não a campanha.</span>
            </label>
            <label className="settings__toggle">
              <input
                type="checkbox"
                checked={draft.prependFirstName}
                onChange={(event) => setDraft({ ...draft, prependFirstName: event.target.checked })}
              />
              <span>Colocar o primeiro nome no início do texto. Sem nome no contato, o marcador {'{nome}'} sai e o resto segue.</span>
            </label>
          </fieldset>

          <fieldset className="settings__section">
            <legend className="settings__legend">Ritmo</legend>
            <label className="settings__toggle">
              <input
                type="checkbox"
                checked={draft.dailyCapEnabled}
                onChange={(event) => setDraft({ ...draft, dailyCapEnabled: event.target.checked })}
              />
              <span>Teto diário por instância. Ao bater, o disparo pausa e retoma sozinho quando houver cota.</span>
            </label>
            <label className="field">
              <span className="field__label">Mensagens por instância por dia ({DAILY_CAP_MIN}–{DAILY_CAP_MAX})</span>
              <input
                className="field__input"
                type="number"
                min={DAILY_CAP_MIN}
                max={DAILY_CAP_MAX}
                value={draft.dailyCap}
                onChange={(event) => setDraft({ ...draft, dailyCap: Number(event.target.value) })}
              />
            </label>
            <label className="settings__toggle">
              <input
                type="checkbox"
                checked={draft.quietHoursEnabled}
                onChange={(event) => setDraft({ ...draft, quietHoursEnabled: event.target.checked })}
              />
              <span>Enviar só neste horário (São Paulo). Fora dele, pausa e retoma na próxima janela.</span>
            </label>
            <div className="settings__clocks">
              <label className="field">
                <span className="field__label">De</span>
                <input
                  className="field__input"
                  type="time"
                  value={draft.quietStart}
                  onChange={(event) => setDraft({ ...draft, quietStart: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Até</span>
                <input
                  className="field__input"
                  type="time"
                  value={draft.quietEnd}
                  onChange={(event) => setDraft({ ...draft, quietEnd: event.target.value })}
                  required
                />
              </label>
            </div>
          </fieldset>

          <button className="contact-form__submit" type="submit" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <p className="contact-form__feedback" role={save.isError ? 'alert' : 'status'}>
            {save.isError ? save.error.message : save.isSuccess ? 'Configuração salva.' : 'O dedup entre listas abertas está sempre ligado.'}
          </p>
        </form>
      ) : null}

      <div className="settings__list">
        <h2 className="settings__legend">Números que pediram para sair</h2>
        <SearchInput value={search} onSearchChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar por telefone ou palavra" label="Buscar supressão" />
        {suppressed.isError ? <p className="contacts__error" role="alert">{suppressed.error.message}</p> : null}
        {remove.isError ? <p className="contacts__error" role="alert">{remove.error.message}</p> : null}
        {suppressed.isSuccess && items.length === 0 ? (
          <EmptyState title={search ? 'Nenhum número encontrado' : 'Ninguém pediu para sair'}>
            {search ? null : 'Quando alguém mandar só a palavra configurada, o número aparece aqui.'}
          </EmptyState>
        ) : null}
        {items.length > 0 ? (
          <DataTable caption="Números suprimidos" columns={columns} rows={items} getRowKey={(row) => row.id} isBusy={suppressed.isFetching} />
        ) : null}
        <Pagination page={page} perPage={SUPPRESSION_PER_PAGE} total={suppressed.data?.total ?? 0} label="Paginação da supressão" onPageChange={setPage} />
      </div>
    </section>
  )
}
