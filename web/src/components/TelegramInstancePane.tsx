import { useDeleteTelegramInstance } from '../hooks/useTelegramInstances'
import { formatDateTime, formatPhone } from '../lib/format'
import type { TelegramInstance } from '../types/api'
import type { TelegramInstancePaneProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { EmptyState } from './EmptyState'
import { StatusLamp } from './StatusLamp'

function BotDetails({ instance }: { instance: TelegramInstance }) {
  const botLink = `https://t.me/${instance.username}`
  return (
    <div className="settings__list">
      <h2 className="settings__legend">Como os contatos entram</h2>
      <p className="settings__hint">
        Mande o link <a href={botLink} target="_blank" rel="noreferrer">{botLink}</a> para os contatos. Quem abrir o bot e tocar em
        “Compartilhar meu telefone” passa a receber os disparos por este bot. Quem não está na agenda entra com o nome do Telegram.
      </p>
      <p className="settings__hint"><strong>{instance.linkedContacts ?? 0}</strong> contato(s) vinculado(s) a este bot.</p>
      {instance.status === 'connected' ? null : (
        <p className="contacts__error" role="alert">O Telegram recusou o token (revogado no @BotFather?). Remova e crie de novo com o token novo.</p>
      )}
    </div>
  )
}

function AccountDetails({ instance }: { instance: TelegramInstance }) {
  return (
    <div className="settings__list">
      <h2 className="settings__legend">Envio pelo telefone</h2>
      <p className="settings__hint">
        Conta {instance.phone ? formatPhone(instance.phone) : ''} conectada. No disparo, envia pelo número do contato — não precisa abrir bot.
        Quem já abriu um bot marcado no disparo recebe pelo bot.
      </p>
      <p className="settings__hint">
        Limites do Telegram: só acha quem tem Telegram e permite ser encontrado pelo número. Mensagem a desconhecidos em volume faz o
        Telegram limitar a conta (PEER_FLOOD) ou banir — use intervalos longos e listas pequenas. Após 3 falhas seguidas a conta sai do rodízio.
      </p>
      {instance.cooldownUntil ? (
        <p className="contacts__error" role="alert">
          Em pausa pelo limite do Telegram até {formatDateTime(instance.cooldownUntil)}. Disparos com esta conta pausam; retome depois desse horário, com lista pequena e intervalo longo.
        </p>
      ) : null}
      {instance.status !== 'connected' && !instance.cooldownUntil ? (
        <p className="contacts__error" role="alert">Sessão encerrada (saiu em “Dispositivos” no celular?). Remova e entre de novo.</p>
      ) : null}
    </div>
  )
}

// Instância do Telegram: bot (link para os contatos) ou conta (envio por telefone); remover
export function TelegramInstancePane({ instance, onRemoved }: TelegramInstancePaneProps) {
  const remove = useDeleteTelegramInstance()
  if (!instance) return <EmptyState title="Instância não encontrada">Escolha uma instância na coluna ao lado ou crie uma nova.</EmptyState>

  return (
    <section className="settings telegram-bot" aria-labelledby="telegram-instance-title">
      <header className="settings__header">
        <p className="contacts__eyebrow">Instância · Telegram {instance.kind === 'bot' ? 'bot' : 'conta'}</p>
        <h1 id="telegram-instance-title" className="contacts__title">{instance.label}</h1>
        <StatusLamp status={instance.status} showLabel />
      </header>

      {instance.kind === 'bot' ? <BotDetails instance={instance} /> : <AccountDetails instance={instance} />}

      <div className="settings__actions">
        <ConfirmButton
          label="Remover instância"
          confirmLabel="Confirmar remoção"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(instance.sessionId, { onSuccess: onRemoved })}
        />
        {remove.isError ? <p className="contacts__error" role="alert">{remove.error.message}</p> : null}
      </div>
    </section>
  )
}
