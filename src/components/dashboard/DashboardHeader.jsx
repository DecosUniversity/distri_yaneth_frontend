function DashboardHeader({ isSidebarVisible, onToggleSidebar, roleName, subtitle, title, userName }) {
  return (
    <header className="dashboard-header">
      <button
        type="button"
        className="menu-toggle"
        onClick={onToggleSidebar}
        aria-label={isSidebarVisible ? 'Ocultar sidebar' : 'Mostrar sidebar'}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="session-meta">
        <div className="session-pill">{userName}</div>
        <div className="role-pill">Rol: {roleName || 'Sin rol'}</div>
      </div>
    </header>
  )
}

export default DashboardHeader
