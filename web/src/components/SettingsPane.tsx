import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
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

function SettingToggle({
  checked,
  title,
  children,
  onChange,
}: {
  checked: boolean
  title: string
  children: ReactNode
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="settings__toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="settings__toggle-copy">
        <span className="settings__toggle-title">{title}</span>
        <span className="settings__toggle-text">{children}</span>
      </span>
    </label>
  )
}

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
      <header className="settings__header">
        <p className="contacts__eyebrow">Conta</p>
        <h1 id="settings-title" className="contacts__title">Configurações</h1>
        <p className="contacts__note">Vale para todas as instâncias. Supressão e dedup protegem o número; o restante só entra quando você liga.</p>
      </header>

      {settings.isError ? <EmptyState title="Não foi possível carregar">{settings.error.message}</EmptyState> : null}

      {draft ? (
        <form className="settings__form" onSubmit={handleSubmit}>
          <div className="settings__grid">
            <section className="settings__section" aria-labelledby="settings-suppression">
              <h2 id="settings-suppression" className="settings__legend">Supressão</h2>
              <SettingToggle
                checked={draft.suppressionEnabled}
                title="Não enviar para quem pedir para sair"
                onChange={(suppressionEnabled) => setDraft({ ...draft, suppressionEnabled })}
              >
                Ligado por padrão. Só entra quem mandar uma destas palavras sozinha.
              </SettingToggle>
              <label className="field">
                <span className="field__label">Palavras, uma por linha</span>
                <textarea
                  className="field__input"
                  rows={5}
                  value={keywordText}
                  onChange={(event) => setKeywordText(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <p className="settings__hint">A mensagem inteira precisa ser a palavra. “Não quero sair da consulta” não entra na lista.</p>
            </section>

            <section className="settings__section" aria-labelledby="settings-during">
              <h2 id="settings-during" className="settings__legend">Durante o disparo</h2>
              <SettingToggle
                checked={draft.stopOnReply}
                title="Tirar da fila quem responder"
                onChange={(stopOnReply) => setDraft({ ...draft, stopOnReply })}
              >
                Só aquele contato, não a campanha. Quem responder antes de receber sai da fila.
              </SettingToggle>
              <SettingToggle
                checked={draft.prependFirstName}
                title="Primeiro nome no início do texto"
                onChange={(prependFirstName) => setDraft({ ...draft, prependFirstName })}
              >
                Sem nome no contato, o marcador {'{nome}'} sai e o resto segue.
              </SettingToggle>
            </section>

            <section className="settings__section settings__section--span" aria-labelledby="settings-pace">
              <h2 id="settings-pace" className="settings__legend">Ritmo</h2>
              <div className="settings__pair">
                <div>
                  <SettingToggle
                    checked={draft.dailyCapEnabled}
                    title="Teto diário por instância"
                    onChange={(dailyCapEnabled) => setDraft({ ...draft, dailyCapEnabled })}
                  >
                    Ao bater, o disparo pausa e retoma sozinho quando houver cota.
                  </SettingToggle>
                  <label className="field settings__cap">
                    <span className="field__label">Por dia ({DAILY_CAP_MIN}–{DAILY_CAP_MAX})</span>
                    <input
                      className="field__input"
                      type="number"
                      min={DAILY_CAP_MIN}
                      max={DAILY_CAP_MAX}
                      value={draft.dailyCap}
                      onChange={(event) => setDraft({ ...draft, dailyCap: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <div>
                  <SettingToggle
                    checked={draft.quietHoursEnabled}
                    title="Enviar só neste horário"
                    onChange={(quietHoursEnabled) => setDraft({ ...draft, quietHoursEnabled })}
                  >
                    Fuso de São Paulo. Fora da janela, pausa e retoma na próxima.
                  </SettingToggle>
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
                </div>
              </div>
            </section>
          </div>

          <div className="settings__actions">
            <button className="contact-form__submit" type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <p className="contact-form__feedback" role={save.isError ? 'alert' : 'status'}>
              {save.isError ? save.error.message : save.isSuccess ? 'Configuração salva.' : 'O dedup entre listas abertas está sempre ligado.'}
            </p>
          </div>
        </form>
      ) : null}

      <section className="settings__list" aria-labelledby="settings-suppressed">
        <h2 id="settings-suppressed" className="settings__legend">Números que pediram para sair</h2>
        <div className="settings__search">
          <SearchInput value={search} onSearchChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar por telefone ou palavra" label="Buscar supressão" />
        </div>
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
      </section>
    </section>
  )
}
