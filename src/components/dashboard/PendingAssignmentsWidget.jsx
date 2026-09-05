import { useEffect, useMemo, useState } from 'react'
import { listRoutesRequest } from '../../services/route.service'

const MAX_ITEMS = 4
const PILOT_ROLE = 'Piloto'
const ROUTE_PREPARADO_STATE = 'Preparado'
const ROUTE_EN_RUTA_STATE = 'En Ruta'
const PENDING_STATES = new Set([ROUTE_PREPARADO_STATE, ROUTE_EN_RUTA_STATE])

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-GT') : '-')

const parseDateScore = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function PendingAssignmentsWidget({ token, roleName }) {
  const isPiloto = roleName === PILOT_ROLE

  const [routes, setRoutes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadWidgetData = async () => {
      setErrorMessage('')
      setIsLoading(true)

      try {
        const routesData = await listRoutesRequest(token)
        setRoutes(Array.isArray(routesData) ? routesData : [])
      } catch (error) {
        setErrorMessage(error.message || 'No se pudieron cargar las asignaciones pendientes')
      } finally {
        setIsLoading(false)
      }
    }

    loadWidgetData()
  }, [token])

  const pendingRoutes = useMemo(() => {
    return routes
      .filter((route) => PENDING_STATES.has(route.estado))
      .sort((left, right) => parseDateScore(right.fecha_creacion) - parseDateScore(left.fecha_creacion))
  }, [routes])

  const visibleRoutes = pendingRoutes.slice(0, MAX_ITEMS)

  return (
    <article className="widget-card widget-card--compact widget-card--production" aria-label="Asignaciones pendientes">
      <div className="widget-compact-header">
        <h3>{isPiloto ? 'Tus entregas pendientes' : 'Entregas pendientes'}</h3>
        <span className="widget-badge">{pendingRoutes.length}</span>
      </div>

      {isLoading ? <p className="widget-muted">Cargando asignaciones...</p> : null}
      {errorMessage ? <p className="widget-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage ? (
        visibleRoutes.length > 0 ? (
          <ul className="widget-list widget-list--compact">
            {visibleRoutes.map((route) => (
              <li key={route.id_ruta}>
                <strong>
                  Entrega #{route.id_ruta} · {route.estado}
                </strong>
                <span>
                  {route.vehiculo_placa || `Vehiculo #${route.id_vehiculo}`}
                  {!isPiloto ? ` · ${route.piloto_nombre || `Piloto #${route.id_piloto}`}` : ''}
                </span>
                <small>
                  {route.estado === ROUTE_EN_RUTA_STATE
                    ? `En ruta desde ${formatDateTime(route.fecha_salida)}`
                    : 'Preparada, pendiente de salida'}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="widget-muted">{isPiloto ? 'No tienes entregas pendientes.' : 'No hay entregas pendientes.'}</p>
        )
      ) : null}
    </article>
  )
}

export default PendingAssignmentsWidget
