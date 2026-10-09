import { useEffect, useState } from 'react'

const findGroupKeyForMenu = (navigationTree, menuKey) => {
  const group = navigationTree.find(
    (entry) => entry.type === 'group' && entry.modules.some((moduleItem) => moduleItem.key === menuKey)
  )

  return group?.key || null
}

function Sidebar({ activeMenu, navigationTree, onLogout, onSelectMenu }) {
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initialGroupKey = findGroupKeyForMenu(navigationTree, activeMenu)
    return initialGroupKey ? new Set([initialGroupKey]) : new Set()
  })

  // Si el modulo activo cambia a uno dentro de un grupo colapsado (por ejemplo, al entrar
  // directo a una vista por default), se despliega ese grupo automaticamente.
  useEffect(() => {
    const groupKey = findGroupKeyForMenu(navigationTree, activeMenu)

    if (!groupKey) {
      return
    }

    setExpandedGroups((previous) => (previous.has(groupKey) ? previous : new Set(previous).add(groupKey)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu])

  const toggleGroup = (groupKey) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous)

      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }

      return next
    })
  }

  return (
    <aside className="sidebar" aria-label="Menu principal">
      <div className="sidebar-brand">
        <div className="sidebar-logo">YANETH</div>
        <div className="sidebar-brand-text">
          <h2>Menu</h2>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Secciones del dashboard">
        {navigationTree.map((entry) =>
          entry.type === 'standalone' ? (
            <button
              key={entry.module.key}
              type="button"
              className={`sidebar-link ${activeMenu === entry.module.key ? 'active' : ''}`}
              onClick={() => onSelectMenu(entry.module.key)}
            >
              {entry.module.label}
            </button>
          ) : (
            <div key={entry.key} className="sidebar-group">
              <button
                type="button"
                className="sidebar-link sidebar-group-toggle"
                aria-expanded={expandedGroups.has(entry.key)}
                onClick={() => toggleGroup(entry.key)}
              >
                <span>{entry.label}</span>
                <span
                  className={`dashboard-collapse-chevron ${expandedGroups.has(entry.key) ? '' : 'is-collapsed'}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {expandedGroups.has(entry.key) ? (
                <div className="sidebar-group-items">
                  {entry.modules.map((moduleItem) => (
                    <button
                      key={moduleItem.key}
                      type="button"
                      className={`sidebar-link sidebar-sublink ${activeMenu === moduleItem.key ? 'active' : ''}`}
                      onClick={() => onSelectMenu(moduleItem.key)}
                    >
                      {moduleItem.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}
      </nav>

      <button type="button" className="logout-button" onClick={onLogout}>
        Cerrar sesion
      </button>
    </aside>
  )
}

export default Sidebar
