import { useState } from 'react'
import { useAllBroadcastLists, useStartBroadcast } from '../hooks/useBroadcasts'
import { useAllTemplates } from '../hooks/useTemplates'
import { DEFAULT_PACING, estimateDurationMinutes, isValidPacing } from '../lib/pacing'
import { earliestScheduleValue, formatSchedule, isValidScheduleValue, localInputToIso } from '../lib/schedule'
import type { BroadcastInput, BroadcastPacing, PanelFile, WhatsAppSession } from '../types/api'
import type { BroadcastSendFormProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { FilePicker } from './FilePicker'
import { PacingFields } from './PacingFields'

const MAX_TEXT_LENGTH = 4096

// Começa na instância aberta no painel; senão, na primeira conectada
const pickInitialSessionId = (sessions: WhatsAppSession[], defaultSessionId: string | null): string =>
  defaultSessionId ?? sessions.find((session) => session.status === 'connected')?.sessionId ?? ''

type ContentMode = 'template' | 'custom'
type WhenMode = 'now' | 'schedule'

interface BlockerInput {
  session: WhatsAppSession | null
  hasList: boolean
  hasContent: boolean
  pacing: BroadcastPacing
  whenMode: WhenMode
  scheduleValue: string
}

function describeBlocker({ session, hasList, hasContent, pacing, whenMode, scheduleValue }: BlockerInput): string | null {
  if (!session) return 'Escolha a instância que vai enviar.'
  // Programado não exige conexão agora: o agendador espera a instância estar online no horário
  if (whenMode === 'now' && session.status !== 'connected') return 'A instância selecionada não está conectada.'
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

export function BroadcastSendForm({ sessions, defaultSessionId }: BroadcastSendFormProps) {
  // null = ainda não escolheu; segue a instância aberta (ou a primeira conectada) quando ela chega
  const [chosenSessionId, setChosenSessionId] = useState<string | null>(null)
  const sessionId = chosenSessionId ?? pickInitialSessionId(sessions, defaultSessionId)
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

  const session = sessions.find((candidate) => candidate.sessionId === sessionId) ?? null
  const listOptions = lists.data?.items ?? []
  const chosenList = listOptions.find((list) => list.id === listId) ?? null
  const hasContent = contentMode === 'template' ? chosenTemplate !== null : text.trim().length > 0 || file !== null
  const blocker = describeBlocker({ session, hasList: chosenList !== null, hasContent, pacing, whenMode, scheduleValue })
  const estimate = chosenList && isValidPacing(pacing) ? `Tempo estimado: ~${estimateDurationMinutes(chosenList.memberCount, pacing)} min.` : ''

  const send = () => {
    if (blocker || !session || !chosenList) return
    const scheduledAt = isScheduling ? localInputToIso(scheduleValue) ?? undefined : undefined
    const input: BroadcastInput = contentMode === 'template' && chosenTemplate
      ? { listId: chosenList.id, pacing, scheduledAt, templateId: chosenTemplate.id }
      : { listId: chosenList.id, pacing, scheduledAt, text: text.trim(), fileId: file?.id ?? null }
    startBroadcast.mutate(
      { sessionId: session.sessionId, input },
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
      <label className="field">
        <span className="field__label">Enviar pela instância</span>
        <select className="field__input" value={sessionId} onChange={(event) => setChosenSessionId(event.target.value)}>
          <option value="">Escolha…</option>
          {sessions.map((candidate) => (
            <option key={candidate.sessionId} value={candidate.sessionId} disabled={candidate.status !== 'connected'}>
              {candidate.pushName ?? candidate.sessionId}{candidate.status === 'connected' ? '' : ' (desconectada)'}
            </option>
          ))}
        </select>
      </label>

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
          <span className="broadcast-send__note">
            Usa a lista e a mensagem como estiverem nesse horário. O painel (Docker) precisa estar rodando e a instância conectada.
          </span>
        </label>
      ) : null}

      <p className="broadcast-send__note">
        Um contato por vez, esperando um tempo sorteado na faixa acima entre cada envio. Dá para abortar no histórico. {estimate}
      </p>
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
