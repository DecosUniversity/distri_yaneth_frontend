import { useState } from 'react'

const readStoredValue = (storageKey, defaultCollapsed) => {
  if (!storageKey || typeof window === 'undefined') {
    return defaultCollapsed
  }

  const stored = window.localStorage.getItem(storageKey)
  return stored === null ? defaultCollapsed : stored === 'true'
}

function CollapsibleSection({ title, subtitle, defaultCollapsed = false, storageKey, headerExtra, children }) {
  const [collapsed, setCollapsed] = useState(() => readStoredValue(storageKey, defaultCollapsed))

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous

      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, String(next))
      }

      return next
    })
  }

  return (
    <section aria-label={title}>
      <div className="providers-header-row">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerExtra}
          <button type="button" className="secondary-button" onClick={toggleCollapsed} aria-expanded={!collapsed}>
            {collapsed ? 'Mostrar' : 'Ocultar'}
            <span className={`dashboard-collapse-chevron ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
              ▾
            </span>
          </button>
        </div>
      </div>

      {!collapsed ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </section>
  )
}

export default CollapsibleSection
