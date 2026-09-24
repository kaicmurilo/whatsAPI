import { useState, type FormEvent } from 'react'
import { useBroadcastList, useSaveBroadcastList } from '../hooks/useBroadcasts'
import type { BroadcastListMember } from '../types/api'
import type { BroadcastListEditorLoaderProps, BroadcastListEditorProps } from '../types/components'
import { ContactPicker } from './ContactPicker'

const MAX_LIST_MEMBERS = 256

const toSelection = (members: BroadcastListMember[]) => new Map(members.map((member) => [member.id, member]))

export function BroadcastListEditor({ listId, initialName, initialMembers, onDone }: BroadcastListEditorProps) {
  const [name, setName] = useState(initialName)
  const [selected, setSelected] = useState(() => toSelection(initialMembers))
  const saveList = useSaveBroadcastList()
  const isOverLimit = selected.size > MAX_LIST_MEMBERS
  const canSave = name.trim().length > 0 && selected.size > 0 && !isOverLimit && !saveList.isPending

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    saveList.mutate({ listId, input: { name: name.trim(), contactIds: [...selected.keys()] } }, { onSuccess: onDone })
  }

  return (
    <form className="list-editor" onSubmit={handleSubmit}>
      <header className="list-editor__header">
        <h2 className="list-editor__title">{listId ? 'Editar lista' : 'Nova lista'}</h2>
        <button type="button" className="list-editor__cancel" onClick={onDone}>Cancelar</button>
      </header>
      <label className="field">
        <span className="field__label">Nome da lista</span>
        <input className="field__input" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoFocus />
      </label>
      <ContactPicker selected={selected} onChange={setSelected} />
      {isOverLimit ? <p className="list-editor__error" role="alert">Máximo de {MAX_LIST_MEMBERS} contatos por lista.</p> : null}
      {saveList.isError ? <p className="list-editor__error" role="alert">{saveList.error.message}</p> : null}
      <button type="submit" className="list-editor__save" disabled={!canSave}>
        {saveList.isPending ? 'Salvando…' : `Salvar lista (${selected.size})`}
      </button>
    </form>
  )
}

// Edição: busca os membros atuais antes de montar o editor (estado inicial vem pronto, sem efeito de sincronização)
export function BroadcastListEditorLoader({ listId, onDone }: BroadcastListEditorLoaderProps) {
  const list = useBroadcastList(listId)
  if (list.isError) return <p className="list-editor__error" role="alert">{list.error.message}</p>
  if (!list.data) return <p className="list-editor__loading">Carregando lista…</p>
  return <BroadcastListEditor listId={listId} initialName={list.data.name} initialMembers={list.data.members} onDone={onDone} />
}
