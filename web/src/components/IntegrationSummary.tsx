import { formatCount, formatRate, rateOf } from '../lib/metricFormat'
import type { IntegrationSummaryProps } from '../types/components'
import { VolumeCard } from './VolumeCard'

// Envios pela API no período: alcance (chats distintos) e o quanto o agrupamento poupou de disparos
export function IntegrationSummary({ bucket, periodLabel }: IntegrationSummaryProps) {
  const sentWithoutBatching = bucket.outgoing + bucket.savedSends
  return (
    <section className="dash-block" aria-labelledby="dash-integration">
      <h2 id="dash-integration" className="dash-block__title">Integração e agrupamento · {periodLabel}</h2>
      <dl className="report-cards">
        <VolumeCard label="Grupos distintos" value={bucket.distinctGroups} detail="grupos que receberam envio" />
        <VolumeCard label="Contatos distintos" value={bucket.distinctContacts} detail="contatos que receberam envio" />
        <VolumeCard label="Mensagens agrupadas" value={bucket.batches} detail={`juntaram ${formatCount(bucket.batchedTexts)} texto(s)`} />
        <VolumeCard
          label="Disparos economizados"
          value={bucket.savedSends}
          detail={`${formatRate(rateOf(bucket.savedSends, sentWithoutBatching))} dos ${formatCount(sentWithoutBatching)} sem agrupar`}
        />
      </dl>
    </section>
  )
}
