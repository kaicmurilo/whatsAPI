import type { EmptyStateProps } from '../types/components'

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      {children ? <div className="empty-state__body">{children}</div> : null}
    </div>
  )
}
