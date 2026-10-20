import { formatPhaseCode } from '../../utils/phaseCode'
import { notifyError, notifySuccess } from '../../utils/toast'

const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  // Respaldo para contextos no seguros (ej. la app abierta por IP en la red local, sin https).
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy failed')
  }
}

// Codigo de fase (SUB-000009) con boton para copiarlo y pegarlo en el buscador de
// Trazabilidad. `code` permite mostrar otro codigo ya existente (ej. el codigo_lote de una
// entrada) en lugar del derivado de tipo+id.
function PhaseCode({ tipo, id, code }) {
  const value = code || formatPhaseCode(tipo, id)

  if (!value || value === '-') {
    return <span>-</span>
  }

  const handleCopy = async (event) => {
    // Puede vivir dentro de una fila o encabezado clickeable: copiar no debe disparar ese click.
    event.stopPropagation()

    try {
      await copyToClipboard(value)
      notifySuccess(`Codigo ${value} copiado`)
    } catch {
      notifyError('No se pudo copiar el codigo')
    }
  }

  return (
    <span className="phase-code">
      <code className="phase-code-value">{value}</code>
      <button
        type="button"
        className="phase-code-copy"
        onClick={handleCopy}
        aria-label={`Copiar codigo ${value}`}
        title="Copiar codigo"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
    </span>
  )
}

export default PhaseCode
