import type { SettingToggleProps } from '../types/components'

export function SettingToggle({ checked, title, children, onChange }: SettingToggleProps) {
  return (
    <label className="settings__toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="settings__toggle-copy">
        <span className="settings__toggle-title">{title}</span>
        <span className="settings__toggle-text">{children}</span>
      </span>
    </label>
  )
}
