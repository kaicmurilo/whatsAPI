import { useState } from 'react'
import { useAllBroadcastLists, useStartBroadcast } from '../hooks/useBroadcasts'
import { DEFAULT_PACING, estimateDurationMinutes, isValidPacing } from '../lib/pacing'
import type { BroadcastPacing, PanelFile, WhatsAppSession } from '../types/api'
import type { BroadcastSendFormProps } from '../types/components'
import { ConfirmButton } from './ConfirmButton'
import { FilePicker } from './FilePicker'
import { PacingFields } from './PacingFields'

const MAX_TEXT_LENGTH = 4096

// Começa na instância aberta no painel; senão, na primeira conectada
const pickInitialSessionId = (sessions: WhatsAppSession[], defaultSessionId: string | null): string =>
  defaultSessionId ?? sessions.find((session) => session.status === 'connected')?.sessionId ?? ''

interface BlockerInput {
  session: WhatsAppSession | null
  hasList: boolean
  hasContent: boolean
  pacing: BroadcastPacing
}

function describeBlocker({ session, hasList, hasContent, pacing }: BlockerInput): string | null {
  if (!session) return 'Escolha a instância que vai enviar.'
  if (session.status !== 'connected') return 'A instância selecionada não está conectada.'
  if (!hasList) return 'Escolha a lista.'
  if (!hasContent) return 'Escreva a mensagem ou anexe um arquivo.'
  if (!isValidPacing(pacing)) return 'Intervalo inválido: use segundos inteiros de 3 a 600, mínimo ≤ máximo.'
  return null
}

export function BroadcastSendForm({ sessions, defaultSessionId }: BroadcastSendFormProps) {
  const [sessionId, setSessionId] = useState(() => pickInitialSessionId(sessions, defaultSessionId))
  const [listId, setListId] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<PanelFile | null>(null)
  const [pacing, setPacing] = useState<BroadcastPacing>(DEFAULT_PACING)
  const lists = useAllBroadcastLists()
  const startBroadcast = useStartBroadcast()

  const session = sessions.find((candidate) => candidate.sessionId === sessionId) ?? null
  const listOptions = lists.data?.items ?? []
  const chosenList = listOptions.find((list) => list.id === listId) ?? null
  const blocker = describeBlocker({ session, hasList: chosenList !== null, hasContent: text.trim().length > 0 || file !== null, pacing })
  const estimate = chosenList && isValidPacing(pacing) ? `Tempo estimado: ~${estimateDurationMinutes(chosenList.memberCount, pacing)} min.` : ''

  const send = () => {
    if (blocker || !session || !chosenList) return
    startBroadcast.mutate(
      { sessionId: session.sessionId, input: { listId: chosenList.id, text: text.trim(), fileId: file?.id ?? null, pacing } },
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
        <select className="field__input" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
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

      <label className="field">
        <span className="field__label">{file ? 'Legenda (opcional)' : 'Mensagem'}</span>
        <textarea className="field__input broadcast-send__text" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_TEXT_LENGTH} rows={4} />
      </label>

      <FilePicker selectedFile={file} onChange={setFile} isDisabled={startBroadcast.isPending} />

      <PacingFields value={pacing} onChange={setPacing} isDisabled={startBroadcast.isPending} />

      <p className="broadcast-send__note">
        Um contato por vez, esperando um tempo sorteado na faixa acima entre cada envio. Dá para abortar no histórico. {estimate}
      </p>
      {blocker ? <p className="broadcast-send__blocker">{blocker}</p> : null}
      {startBroadcast.isError ? <p className="broadcast-send__error" role="alert">{startBroadcast.error.message}</p> : null}
      {startBroadcast.isSuccess ? <p className="broadcast-send__ok" role="status">Disparo iniciado — acompanhe no histórico.</p> : null}

      <ConfirmButton
        className="broadcast-send__submit"
        tone="primary"
        label={chosenList ? `Enviar para ${chosenList.memberCount} contatos` : 'Enviar'}
        confirmLabel={`Confirmar envio para ${chosenList?.memberCount ?? 0}`}
        isDisabled={blocker !== null}
        isPending={startBroadcast.isPending}
        onConfirm={send}
      />
    </section>
  )
}
