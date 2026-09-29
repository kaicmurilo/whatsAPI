import { useState, type CSSProperties } from 'react'
import { useMetrics } from '../hooks/useMetrics'
import { whatsappIdentity } from '../lib/sessionLabel'
import type { DailyMetric, InstanceMetrics, MetricBucket, MetricPeriod, WhatsAppSession } from '../types/api'
import type { DataTableColumn } from '../types/components'
import { DataTable } from './DataTable'
import { EmptyState } from './EmptyState'

const PERIODS: MetricPeriod[] = ['today', 'yesterday', 'week', 'month', 'last30', 'all']

const PERIOD_LABEL: Record<MetricPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: '7 dias',
  month: 'Este mês',
  last30: '30 dias',
  all: 'Tudo',
}

const rateOf = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

const formatRate = (value: number | null): string => (value === null ? '—' : `${Math.round(value * 100)}%`)

const formatCount = (value: number): string => value.toLocaleString('pt-BR')

const formatDay = (day: string): string => {
  const [, month, date] = day.split('-')
  return `${date}/${month}`
}

function RateCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="dash-rate">
      <p className="dash-rate__label">{label}</p>
      <p className="dash-rate__value">{value}</p>
      <p className="dash-rate__hint">{hint}</p>
    </article>
  )
}

function VolumeCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="report-card">
      <dt className="report-card__label">{label}</dt>
      <dd className="report-card__value">{formatCount(value)}</dd>
      <dd className="report-card__percent">{detail}</dd>
    </div>
  )
}

function DailyChart({ days }: { days: DailyMetric[] }) {
  const peak = Math.max(1, ...days.map((day) => day.sent))
  return (
    <ol className="dash-chart" aria-label="Enviadas nos últimos 30 dias">
      {days.map((day, index) => {
        const showLabel = index === 0 || index === days.length - 1 || index % 5 === 0
        const height = day.sent === 0 ? '0%' : `${Math.max((day.sent / peak) * 100, 6)}%`
        return (
          <li key={day.day} className="dash-chart__col">
            <span className="dash-chart__plot">
              <span className="dash-chart__bar" style={{ '--bar': height } as CSSProperties} title={`${formatDay(day.day)}: ${formatCount(day.sent)} enviadas, ${formatCount(day.replied)} respostas`} />
            </span>
            <span className="dash-chart__label">{showLabel ? formatDay(day.day) : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

function bucketRates(bucket: MetricBucket) {
  return {
    delivery: rateOf(bucket.delivered, bucket.sent),
    read: rateOf(bucket.read, bucket.sent),
    readOfDelivered: rateOf(bucket.read, bucket.delivered),
    reply: rateOf(bucket.replied, bucket.sent),
  }
}

export function DashboardPane({ sessions }: { sessions: WhatsAppSession[] }) {
  const metrics = useMetrics()
  const [period, setPeriod] = useState<MetricPeriod>('today')

  if (metrics.isPending) return <EmptyState title="Carregando métricas" />
  if (metrics.isError) return <EmptyState title="Não foi possível carregar">{metrics.error.message}</EmptyState>

  const data = metrics.data
  const bucket = data.periods[period]
  const rates = bucketRates(bucket)
  const columns: DataTableColumn<InstanceMetrics>[] = [
    {
      key: 'instance',
      header: 'Instância',
      render: (row) => {
        const session = sessions.find((item) => item.sessionId === row.sessionId)
        const identity = session ? whatsappIdentity(session) : null
        return (
          <span className="dash-instance">
            <span>{row.sessionId}</span>
            {identity ? <span className="dash-instance__id">{identity}</span> : null}
          </span>
        )
      },
    },
    { key: 'sent', header: 'Enviadas', align: 'end', render: (row) => formatCount(row.periods[period].sent) },
    { key: 'delivered', header: 'Entrega', align: 'end', render: (row) => formatRate(rateOf(row.periods[period].delivered, row.periods[period].sent)) },
    { key: 'read', header: 'Leitura', align: 'end', render: (row) => formatRate(rateOf(row.periods[period].read, row.periods[period].sent)) },
    { key: 'replied', header: 'Resposta', align: 'end', render: (row) => formatRate(rateOf(row.periods[period].replied, row.periods[period].sent)) },
  ]

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="contacts__eyebrow">Transmissão</p>
          <h1 className="contacts__title">Painel</h1>
          <p className="contacts__note">
            Enviadas são contatos que o disparo entregou à fila do WhatsApp. Resposta é uma mensagem recebida desse número em até {data.replyWindowDays} dias, em qualquer instância da conta. Fuso {data.timeZone}.
          </p>
        </div>
        <button type="button" className="report__refresh" onClick={() => void metrics.refetch()} disabled={metrics.isFetching}>
          {metrics.isFetching ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      <dl className="dash-snapshot">
        <div><dt>Em andamento</dt><dd>{formatCount(data.snapshot.running)}</dd></div>
        <div><dt>Pausados</dt><dd>{formatCount(data.snapshot.paused)}</dd></div>
        <div><dt>Programados</dt><dd>{formatCount(data.snapshot.scheduled)}</dd></div>
      </dl>

      <div className="report-filter" role="radiogroup" aria-label="Período">
        {PERIODS.map((key) => (
          <button
            key={key}
            type="button"
            className="report-filter__option"
            role="radio"
            aria-checked={period === key}
            onClick={() => setPeriod(key)}
          >
            {PERIOD_LABEL[key]}
          </button>
        ))}
      </div>

      <div className="dash-rates">
        <RateCard label="Taxa de entrega" value={formatRate(rates.delivery)} hint={`${formatCount(bucket.delivered)} de ${formatCount(bucket.sent)} enviadas`} />
        <RateCard label="Taxa de leitura" value={formatRate(rates.read)} hint={rates.readOfDelivered === null ? 'Sem recibo de entrega' : `${formatRate(rates.readOfDelivered)} das entregues`} />
        <RateCard label="Taxa de resposta" value={formatRate(rates.reply)} hint={`${formatCount(bucket.replied)} responderam em ${data.replyWindowDays} dias`} />
      </div>

      <dl className="report-cards">
        <VolumeCard label="Enviadas" value={bucket.sent} detail={period === 'today' ? `ontem ${formatCount(data.periods.yesterday.sent)}` : PERIOD_LABEL[period]} />
        <VolumeCard label="Números únicos" value={bucket.uniquePhones} detail="telefones distintos" />
        <VolumeCard label="Reproduzidas" value={bucket.played} detail={formatRate(rateOf(bucket.played, bucket.sent))} />
        <VolumeCard label="Falhas" value={bucket.failed} detail="disparos iniciados no período" />
        <VolumeCard label="Suprimidos" value={bucket.suppressed} detail="não enviados, pediram saída" />
        <VolumeCard label="Saídas" value={bucket.optOuts} detail="palavra de supressão no período" />
        <VolumeCard label="Campanhas" value={bucket.campaigns} detail="disparos criados no período" />
      </dl>

      <section className="dash-block">
        <h2 className="dash-block__title">Últimos 30 dias</h2>
        <DailyChart days={data.daily} />
      </section>

      <section className="dash-block">
        <h2 className="dash-block__title">Por instância · {PERIOD_LABEL[period]}</h2>
        {data.instances.length === 0 ? (
          <EmptyState title="Nenhuma instância">As enviadas por número aparecem aqui.</EmptyState>
        ) : (
          <DataTable caption="Métricas por instância" columns={columns} rows={data.instances} getRowKey={(row) => row.sessionId} />
        )}
      </section>
    </section>
  )
}
