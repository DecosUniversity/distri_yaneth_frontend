import { useEffect, useMemo, useState } from 'react'
import { listProductionProcessesRequest } from '../../services/production.service'

const MAX_ITEMS = 4
const REFRESH_INTERVAL_MS = 30000
const PROCESS_ACTIVE_STATE = 'En proceso'

const formatKg = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

const parseDateScore = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function ProductionStatusWidget({ token }) {
  const [processes, setProcesses] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let isCancelled = false

    const loadWidgetData = async ({ showSpinner } = {}) => {
      if (showSpinner) {
        setIsLoading(true)
      }

      setErrorMessage('')

      try {
        const processesData = await listProductionProcessesRequest(token)

        if (isCancelled) {
          return
        }

        setProcesses(Array.isArray(processesData) ? processesData : [])
        setLastUpdated(new Date())
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(error.message || 'No se pudo cargar el estado de produccion')
        }
      } finally {
        if (showSpinner && !isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadWidgetData({ showSpinner: true })
    const intervalId = window.setInterval(() => loadWidgetData({ showSpinner: false }), REFRESH_INTERVAL_MS)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [token])

  const activeProcesses = useMemo(() => {
    return processes
      .filter((process) => process.estado_proceso === PROCESS_ACTIVE_STATE)
      .sort((left, right) => parseDateScore(right.fecha_inicio) - parseDateScore(left.fecha_inicio))
  }, [processes])

  const totalKgEnProceso = useMemo(
    () => activeProcesses.reduce((sum, process) => sum + (Number(process.cantidad_ingresada_kg) || 0), 0),
    [activeProcesses]
  )

  const visibleProcesses = activeProcesses.slice(0, MAX_ITEMS)

  return (
    <article className="widget-card widget-card--compact widget-card--production" aria-label="Produccion en tiempo real">
      <div className="widget-compact-header">
        <h3>Produccion en curso</h3>
        <span className="widget-badge">{activeProcesses.length}</span>
      </div>

      {isLoading ? <p className="widget-muted">Cargando produccion...</p> : null}
      {errorMessage ? <p className="widget-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage ? (
        <>
          <p className="widget-muted" style={{ margin: '0 0 8px' }}>
            {activeProcesses.length} proceso{activeProcesses.length === 1 ? '' : 's'} activo
            {activeProcesses.length === 1 ? '' : 's'} · {formatKg(totalKgEnProceso)} kg en proceso
          </p>

          {visibleProcesses.length > 0 ? (
            <ul className="widget-list widget-list--compact">
              {visibleProcesses.map((process) => (
                <li key={process.id_proceso}>
                  <strong>
                    #{process.id_proceso} · {process.producto_resultado_nombre || 'Producto'}
                  </strong>
                  <span>
                    Sub-lote #{process.id_sublote} ({process.codigo_sublote || '-'}) · Etapa: {process.etapa_actual || 'Sin iniciar'}
                  </span>
                  <small>
                    Ingresado: {formatKg(process.cantidad_ingresada_kg)} kg · Merma: {formatKg(process.total_merma_kg)} kg
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="widget-muted">No hay procesos de produccion activos.</p>
          )}

          {lastUpdated ? (
            <small className="widget-muted">Actualizado {lastUpdated.toLocaleTimeString('es-GT')}</small>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

export default ProductionStatusWidget
