// Boton de recarga como icono, fijo en la esquina superior derecha del panel-card que lo
// contiene (ver CSS .reload-icon-button), tanto en escritorio como en movil.
function ReloadButton({ onClick, isLoading, label = 'Recargar' }) {
  return (
    <button
      type="button"
      className={`reload-icon-button ${isLoading ? 'is-loading' : ''}`}
      onClick={onClick}
      disabled={isLoading}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.9-6.6" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    </button>
  )
}

export default ReloadButton
