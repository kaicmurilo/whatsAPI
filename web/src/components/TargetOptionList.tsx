import { hasTarget, targetKey } from '../lib/downAlertTargets'
import type { TargetOptionListProps } from '../types/components'
import { Pagination } from './Pagination'

// Lista marcável com busca e paginação do servidor; a seleção vive no pai
export function TargetOptionList({
  label, search, onSearchChange, options, selected, onToggle, page, perPage, total, onPageChange, isFetching, emptyText,
}: TargetOptionListProps) {
  return (
    <fieldset className="contact-picker">
      <legend className="field__label">{label}</legend>
      <div className="contact-picker__toolbar">
        <input
          className="search-input"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar"
          aria-label={`Buscar ${label.toLowerCase()}`}
        />
      </div>
      <ul className="contact-picker__list" aria-busy={isFetching}>
        {options.map(({ target, detail }) => (
          <li key={targetKey(target)}>
            <label className="contact-picker__item">
              <input type="checkbox" checked={hasTarget(selected, target)} onChange={() => onToggle(target)} />
              <span className="contact-picker__name">{target.name}</span>
              <span className="contact-picker__phone">{detail}</span>
            </label>
          </li>
        ))}
      </ul>
      {!isFetching && options.length === 0 ? <p className="contact-picker__empty">{emptyText}</p> : null}
      <Pagination page={page} perPage={perPage} total={total} label={`Paginação de ${label.toLowerCase()}`} onPageChange={onPageChange} />
    </fieldset>
  )
}
