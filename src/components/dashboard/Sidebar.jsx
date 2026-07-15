function Sidebar({ activeMenu, modules, onLogout, onSelectMenu }) {
  return (
    <aside className="sidebar" aria-label="Menu principal">
      <div className="sidebar-brand">
        <div className="sidebar-logo">SISTEMA</div>
        <div>
          <h2>Panel principal</h2>
          <p>Gestion operativa</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Secciones del dashboard">
        {modules.map((moduleItem) => (
          <button
            key={moduleItem.key}
            type="button"
            className={`sidebar-link ${activeMenu === moduleItem.key ? 'active' : ''}`}
            onClick={() => onSelectMenu(moduleItem.key)}
          >
            {moduleItem.label}
          </button>
        ))}
      </nav>

      <button type="button" className="logout-button" onClick={onLogout}>
        Cerrar sesion
      </button>
    </aside>
  )
}

export default Sidebar
