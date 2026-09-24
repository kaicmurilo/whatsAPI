import type { PaginationProps } from '../types/components'

export function Pagination({ page, perPage, total, label, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / perPage))
  if (pageCount <= 1) return null

  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="pagination__step" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ‹ Anterior
      </button>
      <span className="pagination__status">{page} / {pageCount}</span>
      <button type="button" className="pagination__step" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Próxima ›
      </button>
    </nav>
  )
}
