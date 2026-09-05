// Boton de cerrar como icono X, fijo en la esquina superior derecha del modal-card que lo
// contiene (ver CSS .modal-close-icon-button).
function ModalCloseButton({ onClick, disabled, label = 'Cerrar' }) {
  return (
    <button
      type="button"
      className="modal-close-icon-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </button>
  )
}

export default ModalCloseButton
