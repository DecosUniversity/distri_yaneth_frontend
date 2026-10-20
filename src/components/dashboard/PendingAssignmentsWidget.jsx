import { useEffect, useMemo, useState } from 'react'
import { getRouteRequest, listRoutesRequest } from '../../services/route.service'

const MAX_ITEMS = 4
const PILOT_ROLE = 'Piloto'
const ROUTE_PREPARADO_STATE = 'Preparado'
const ROUTE_EN_RUTA_STATE = 'En Ruta'
const PENDING_STATES = new Set([ROUTE_PREPARADO_STATE, ROUTE_EN_RUTA_STATE])
const ORDER_ENTREGADO_STATE = 'Entregado'
const ORDER_CON_DEVOLUCION_STATE = 'Con Devolucion'
const ORDER_EN_RUTA_STATE = 'En Ruta'

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-GT') : '-')

const parseDateScore = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

// Mismo criterio que RoutesModule para resumir el estado de cada pedido dentro del manifiesto,
// adaptado a etiquetas cortas para esta tarjeta compacta del dashboard.
const formatManifestItemStatus = (item) => {
  const total = Number(item.total_lineas || 0)
  const delivered = Number(item.lineas_entregadas || 0)

  if (item.pedido_estado === ORDER_ENTREGADO_STATE) {
    return 'Entregado'
  }

  if (item.pedido_estado === ORDER_CON_DEVOLUCION_STATE) {
    return delivered === 0 ? 'Rechazado' : 'Parcial'
  }

  if (item.pedido_estado === ORDER_EN_RUTA_STATE) {
    if (total > 0 && delivered === total) {
      return 'Entregado'
    }

    if (delivered > 0 && delivered < total) {
      return 'Parcial'
    }

    return 'En camino'
  }

  return 'Pendiente de salida'
}

const selectRelevantRoutes = (allRoutes, isPiloto, userId) =>
  allRoutes
    .filter((route) => PENDING_STATES.has(route.estado))
    // Un piloto solo debe ver sus propias entregas asignadas, no las de todos los pilotos.
    // En cuanto el piloto cierra su ruta (entrega confirmada), deja de estar en PENDING_STATES
    // y desaparece de esta lista por si sola.
    .filter((route) => !isPiloto || String(route.id_piloto) === String(userId))
    .sort((left, right) => parseDateScore(right.fecha_creacion) - parseDateScore(left.fecha_creacion))

function PendingAssignmentsWidget({ token, roleName, userId }) {
  const isPiloto = roleName === PILOT_ROLE

  const [routes, setRoutes] = useState([])
  const [manifestsByRoute, setManifestsByRoute] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingManifests, setIsLoadingManifests] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadWidgetData = async () => {
      setErrorMessage('')
      setIsLoading(true)

      try {
        const routesData = await listRoutesRequest(token)
        const allRoutes = Array.isArray(routesData) ? routesData : []
        setRoutes(allRoutes)

        // Cada entrega puede llevar pedidos de varios clientes: se trae el detalle (manifiesto)
        // de cada ruta visible para poder mostrar a que clientes corresponde.
        const routesToExpand = selectRelevantRoutes(allRoutes, isPiloto, userId).slice(0, MAX_ITEMS)
        setIsLoadingManifests(true)

        const manifestEntries = await Promise.all(
          routesToExpand.map(async (route) => {
            try {
              const detail = await getRouteRequest(route.id_ruta, token)
              return [route.id_ruta, Array.isArray(detail?.manifiesto) ? detail.manifiesto : []]
            } catch {
              return [route.id_ruta, []]
            }
          })
        )
        setManifestsByRoute(Object.fromEntries(manifestEntries))
      } catch (error) {
        setErrorMessage(error.message || 'No se pudieron cargar las asignaciones pendientes')
      } finally {
        setIsLoading(false)
        setIsLoadingManifests(false)
      }
    }

    loadWidgetData()
  }, [token, isPiloto, userId])

  const pendingRoutes = useMemo(
    () => selectRelevantRoutes(routes, isPiloto, userId),
    [routes, isPiloto, userId]
  )

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
            {visibleRoutes.map((route) => {
              const manifest = manifestsByRoute[route.id_ruta] || []

              return (
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

                  {isLoadingManifests && manifest.length === 0 ? (
                    <small className="widget-muted">Cargando clientes...</small>
                  ) : manifest.length > 0 ? (
                    <ul className="widget-list widget-list--nested">
                      {manifest.map((item) => (
                        <li key={item.id_pedido}>
                          <span>
                            Pedido #{item.id_pedido} · {item.nombre_comercial || `Cliente #${item.id_cliente}`}
                          </span>
                          <small>{formatManifestItemStatus(item)}</small>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="widget-muted">{isPiloto ? 'No tienes entregas pendientes.' : 'No hay entregas pendientes.'}</p>
        )
      ) : null}
    </article>
  )
}

export default PendingAssignmentsWidget
