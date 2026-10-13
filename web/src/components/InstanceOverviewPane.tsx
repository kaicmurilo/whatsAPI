import type { InstanceOverviewPaneProps } from '../types/components'
import { EmptyState } from './EmptyState'
import { InstanceHeader } from './InstanceHeader'

// Visualização de mensagens desligada em Configurações: só o controle da instância, sem consultar conversas
export function InstanceOverviewPane({ session, onRemoved }: InstanceOverviewPaneProps) {
  return (
    <section className="chats" aria-labelledby="chats-title">
      <InstanceHeader session={session} onRemoved={onRemoved} />
      <EmptyState title="Conversas ocultas">
        A visualização de mensagens está desligada em Configurações. A instância segue enviando disparos normalmente.
      </EmptyState>
    </section>
  )
}
