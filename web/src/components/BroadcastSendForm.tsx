import { useState } from 'react'
import { useAllBroadcastLists, useStartBroadcast } from '../hooks/useBroadcasts'
import { useAllTemplates } from '../hooks/useTemplates'
import { useTelegramInstances } from '../hooks/useTelegramInstances'
import { DEFAULT_PACING, estimateDurationMinutes, isValidPacing } from '../lib/pacing'
import { earliestScheduleValue, formatSchedule, isValidScheduleValue, localInputToIso } from '../lib/schedule'
import type { BroadcastChannel, BroadcastInput, BroadcastPacing, PanelFile, SenderInstance } from '../types/api'
import type { BroadcastSendFormProps } from '../types/components'
import { ChannelPicker } from './ChannelPicker'
import { ConfirmButton } from './ConfirmButton'
import { FilePicker } from './FilePicker'
import { InstancePicker } from './InstancePicker'
import { PacingFields } from './PacingFields'

const MAX_TEXT_LENGTH = 4096

// Começa na instância aberta no painel, se estiver conectada; senão, na primeira conectada
const pickInitialSessionIds = (sessions: SenderInstance[], defaultSessionId: string | null): string[] => {
  const preferred = sessions.find((session) => session.sessionId === defaultSessionId)
  if (preferred?.status === 'connected') return [preferred.sessionId]
  const connected = sessions.find((session) => session.status === 'connected')
  return connected ? [connected.sessionId] : []
}

type ContentMode = 'template' | 'custom'
type WhenMode = 'now' | 'schedule'

interface SenderInput {
  channel: BroadcastChannel
  sessionIds: string[]
  sessions: SenderInstance[]
  requireConnected: boolean
}

interface BlockerInput extends SenderInput {
  hasList: boolean
  hasContent: boolean
  pacing: BroadcastPacing
  whenMode: WhenMode
  scheduleValue: string
}

// Quem envia: ao menos uma instância do canal (conectada, para enviar agora)
function describeSenderBlocker({ channel, sessionIds, sessions, requireConnected }: SenderInput): string | null {
  if (channel === 'telegram' && sessions.length === 0) return 'Crie uma instância do Telegram em “Nova instância”.'
  if (sessionIds.length === 0) return 'Escolha ao menos uma instância.'
  const anyConnected = sessionIds.some((sessionId) => sessions.find((session) => session.sessionId === sessionId)?.status === 'connected')
  if (requireConnected && !anyConnected) return 'Nenhuma das instâncias selecionadas está conectada.'
  return null
}

function describeBlocker({ hasList, hasContent, pacing, whenMode, scheduleValue, ...sender }: BlockerInput): string | null {
  const senderBlocker = describeSenderBlocker(sender)
  if (senderBlocker) return senderBlocker
  if (!hasList) return 'Escolha a lista.'
  if (!hasContent) return 'Escolha uma mensagem salva ou escreva a mensagem.'
  if (!isValidPacing(pacing)) return 'Intervalo inválido: use segundos inteiros de 3 a 600, mínimo ≤ máximo.'
  if (whenMode === 'schedule' && !isValidScheduleValue(scheduleValue)) return 'Escolha data e hora com pelo menos 1 minuto à frente.'
  return null
}

function submitLabel(memberCount: number | null, scheduleValue: string | null): string {
  const audience = memberCount === null ? '' : ` (${memberCount} contatos)`
  if (scheduleValue !== null) return isValidScheduleValue(scheduleValue) ? `Programar para ${formatSchedule(scheduleValue)}${audience}` : 'Programar'
  return memberCount === null ? 'Enviar' : `Enviar para ${memberCount} contatos`
}

const QUEUE_NOTES: Record<BroadcastChannel, string> = {
  whatsapp: 'Fila única: um contato por vez, no intervalo sorteado. Várias instâncias ou várias listas não disparam juntas — a próxima só sai depois da espera. Instância desconectada pode ser marcada: fica no rodízio e só envia quando voltar. Para começar agora, pelo menos uma precisa estar conectada. Dá para abortar no histórico.',
  telegram: 'Um contato por vez, no intervalo sorteado, em rodízio entre as instâncias marcadas. Quem abriu um bot marcado recebe pelo bot; os demais, pela conta marcada (pelo telefone — só acha quem tem Telegram e permite ser achado pelo número). Sem conta marcada, quem não abriu bot fica como “sem Telegram vinculado”. Conta: use intervalo longo, o Telegram limita mensagens a desconhecidos. O Telegram não informa entrega nem leitura.',
}

const SCHEDULE_NOTES: Record<BroadcastChannel, string> = {
  whatsapp: 'Usa a lista e a mensagem como estiverem nesse horário. O painel (Docker) precisa estar rodando e todas as instâncias selecionadas conectadas.',
  telegram: 'Usa a lista e a mensagem como estiverem nesse horário. O painel (Docker) precisa estar rodando e todas as instâncias selecionadas conectadas.',
}

export function BroadcastSendForm({ sessions, defaultSessionId }: BroadcastSendFormProps) {
  const [channel, setChannel] = useState<BroadcastChannel>('whatsapp')
  const telegramInstances = useTelegramInstances().data ?? []
  // Seleção própria por canal: trocar de canal não perde a escolha do outro
  const [chosenIds, setChosenIds] = useState<Record<BroadcastChannel, string[] | null>>({ whatsapp: null, telegram: null })
  const instances: SenderInstance[] = channel === 'telegram' ? telegramInstances : sessions
  const sessionIds = chosenIds[channel] ?? pickInitialSessionIds(instances, channel === 'whatsapp' ? defaultSessionId : null)
  const [listId, setListId] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<PanelFile | null>(null)
  const [pacing, setPacing] = useState<BroadcastPacing>(DEFAULT_PACING)
  const [contentMode, setContentMode] = useState<ContentMode>('template')
  const [templateId, setTemplateId] = useState('')
  const [whenMode, setWhenMode] = useState<WhenMode>('now')
  const [scheduleValue, setScheduleValue] = useState('')
  const isScheduling = whenMode === 'schedule'
  const templates = useAllTemplates()
  const templateOptions = templates.data?.items ?? []
  const chosenTemplate = templateOptions.find((template) => template.id === templateId) ?? null
  const lists = useAllBroadcastLists()
  const startBroadcast = useStartBroadcast()

  const listOptions = lists.data?.items ?? []
  const chosenList = listOptions.find((list) => list.id === listId) ?? null
  const hasContent = contentMode === 'template' ? chosenTemplate !== null : text.trim().length > 0 || file !== null
  const blocker = describeBlocker({
    channel,
    sessionIds,
    sessions: instances,
    requireConnected: !isScheduling,
    hasList: chosenList !== null,
    hasContent,
    pacing,
    whenMode,
    scheduleValue,
  })
  const estimate = chosenList && isValidPacing(pacing) ? `Tempo estimado: ~${estimateDurationMinutes(chosenList.memberCount, pacing)} min.` : ''

  const send = () => {
    if (blocker || !chosenList) return
    const scheduledAt = isScheduling ? localInputToIso(scheduleValue) ?? undefined : undefined
    const connectedId = sessionIds.find((sessionId) => sessions.find((session) => session.sessionId === sessionId)?.status === 'connected')
    const base = { listId: chosenList.id, channel, pacing, scheduledAt, sessionIds }
    const input: BroadcastInput = contentMode === 'template' && chosenTemplate
      ? { ...base, templateId: chosenTemplate.id }
      : { ...base, text: text.trim(), fileId: file?.id ?? null }
    startBroadcast.mutate(
      // Telegram não tem instância do WhatsApp na URL: vai para a rota da conta
      { sessionId: channel === 'telegram' ? null : connectedId ?? sessionIds[0], input },
      {
        onSuccess: () => {
          setText('')
          setFile(null)
        },
      },
    )
  }

  return (
    <section className="broadcast-send" aria-labelledby="broadcast-send-title">
      <h2 id="broadcast-send-title" className="broadcasts__section-title">Disparar</h2>
      <ChannelPicker value={channel} onChange={setChannel} />
      <InstancePicker
        key={channel}
        sessions={instances}
        selectedIds={sessionIds}
        onChange={(ids) => setChosenIds({ ...chosenIds, [channel]: ids })}
        allowDisconnected
        isDisabled={startBroadcast.isPending}
        legend={channel === 'telegram' ? 'Instâncias do Telegram que enviam' : undefined}
      />

      <label className="field">
        <span className="field__label">Lista</span>
        <select className="field__input" value={listId} onChange={(event) => setListId(event.target.value)}>
          <option value="">Escolha…</option>
          {listOptions.map((list) => (
            <option key={list.id} value={list.id}>{list.name} ({list.memberCount})</option>
          ))}
        </select>
      </label>

      <div className="content-mode" role="radiogroup" aria-label="Conteúdo do disparo">
        <button type="button" role="radio" aria-checked={contentMode === 'template'} className="report-filter__option" onClick={() => setContentMode('template')}>
          Mensagem salva
        </button>
        <button type="button" role="radio" aria-checked={contentMode === 'custom'} className="report-filter__option" onClick={() => setContentMode('custom')}>
          Escrever agora
        </button>
      </div>

      {contentMode === 'template' ? (
        <label className="field">
          <span className="field__label">Mensagem</span>
          <select className="field__input" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">{templateOptions.length === 0 ? 'Nenhuma — crie em “Mensagens”' : 'Escolha…'}</option>
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}{template.attachmentCount > 0 ? ` · 📎 ${template.attachmentCount}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="field">
            <span className="field__label">{file ? 'Legenda (opcional)' : 'Mensagem'}</span>
            <textarea className="field__input broadcast-send__text" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_TEXT_LENGTH} rows={4} />
          </label>
          <FilePicker selectedFile={file} onChange={setFile} isDisabled={startBroadcast.isPending} />
        </>
      )}

      <PacingFields value={pacing} onChange={setPacing} isDisabled={startBroadcast.isPending} />

      <div className="content-mode" role="radiogroup" aria-label="Quando enviar">
        <button type="button" role="radio" aria-checked={whenMode === 'now'} className="report-filter__option" onClick={() => setWhenMode('now')}>
          Enviar agora
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isScheduling}
          className="report-filter__option"
          onClick={() => {
            setWhenMode('schedule')
            if (!scheduleValue) setScheduleValue(earliestScheduleValue())
          }}
        >
          Programar
        </button>
      </div>
      {isScheduling ? (
        <label className="field">
          <span className="field__label">Data e hora do envio</span>
          <input
            type="datetime-local"
            className="field__input"
            value={scheduleValue}
            min={earliestScheduleValue()}
            onChange={(event) => setScheduleValue(event.target.value)}
          />
          <span className="broadcast-send__note">{SCHEDULE_NOTES[channel]}</span>
        </label>
      ) : null}

      <p className="broadcast-send__note">{QUEUE_NOTES[channel]} {estimate}</p>
      {blocker ? <p className="broadcast-send__blocker">{blocker}</p> : null}
      {startBroadcast.isError ? <p className="broadcast-send__error" role="alert">{startBroadcast.error.message}</p> : null}
      {startBroadcast.isSuccess ? (
        <p className="broadcast-send__ok" role="status">
          {startBroadcast.data.scheduledAt && startBroadcast.data.status === 'scheduled'
            ? `Programado para ${formatSchedule(startBroadcast.data.scheduledAt)} — dá para cancelar no histórico.`
            : 'Disparo iniciado — acompanhe no histórico.'}
        </p>
      ) : null}

      <ConfirmButton
        className="broadcast-send__submit"
        tone="primary"
        label={submitLabel(chosenList?.memberCount ?? null, isScheduling ? scheduleValue : null)}
        confirmLabel={isScheduling ? 'Confirmar programação' : `Confirmar envio para ${chosenList?.memberCount ?? 0}`}
        isDisabled={blocker !== null}
        isPending={startBroadcast.isPending}
        onConfirm={send}
      />
    </section>
  )
}
