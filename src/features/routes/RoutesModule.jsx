import { Fragment, useEffect, useMemo, useState } from 'react'
import { listOrdersRequest, getOrderRequest } from '../../services/order.service'
import { listVehiclesRequest } from '../../services/vehicle.service'
import {
  closeRouteRequest,
  confirmRouteDeliveriesRequest,
  createRouteRequest,
  getRouteRequest,
  listAvailablePilotsRequest,
  listRoutesRequest,
  registerRouteDepartureRequest,
} from '../../services/route.service'
import ReloadButton from '../../components/common/ReloadButton'
import ModalCloseButton from '../../components/common/ModalCloseButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const PILOT_ROLE = 'Piloto'
const ADMIN_ROLE = 'Administrador'
const VEHICLE_AVAILABLE_STATE = 'Disponible'
const ORDER_PENDING_STATE = 'Pendiente'
const ORDER_EN_RUTA_STATE = 'En Ruta'
const ORDER_ENTREGADO_STATE = 'Entregado'
const ORDER_CON_DEVOLUCION_STATE = 'Con Devolucion'
const ROUTE_PREPARADO_STATE = 'Preparado'
const ROUTE_EN_RUTA_STATE = 'En Ruta'
const ROUTE_GESTION_STATES = new Set([ROUTE_PREPARADO_STATE, ROUTE_EN_RUTA_STATE])

const computeManifestStatus = (item) => {
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

    return 'En Ruta'
  }

  return item.pedido_estado
}

const EMPTY_CREATE_FORM = { id_vehiculo: '', id_piloto: '' }
const EMPTY_SALIDA_FORM = { km_salida: '', galones_combustible: '' }
const EMPTY_CERRAR_FORM = { km_llegada: '' }

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-GT') : '-')

const formatUbicacion = (order) => {
  const parts = []

  if (order.zona) {
    parts.push(`Zona ${order.zona}`)
  }

  if (order.municipio) {
    parts.push(order.municipio)
  }

  if (order.departamento) {
    parts.push(order.departamento)
  }

  return parts.length > 0 ? parts.join(', ') : '-'
}

// Agrupa/ordena por ubicacion (departamento, municipio, zona) para poder armar el
// manifiesto con entregas de la misma zona juntas.
const parseZonaSortValue = (zona) => {
  const numeric = Number.parseInt(zona, 10)
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric
}

const compareByZone = (left, right) => {
  const departamentoCompare = (left.departamento || '').localeCompare(right.departamento || '', 'es')
  if (departamentoCompare !== 0) {
    return departamentoCompare
  }

  const municipioCompare = (left.municipio || '').localeCompare(right.municipio || '', 'es')
  if (municipioCompare !== 0) {
    return municipioCompare
  }

  return parseZonaSortValue(left.zona) - parseZonaSortValue(right.zona)
}

function RoutesModule({ token, isActive, roleName }) {
  const isPiloto = roleName === PILOT_ROLE
  const isAdmin = roleName === ADMIN_ROLE

  const [routes, setRoutes] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [pilotos, setPilotos] = useState([])
  const [viewMode, setViewMode] = useState('gestion')
  const [consultaSearchTerm, setConsultaSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])

  const [detailRoute, setDetailRoute] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [activeAction, setActiveAction] = useState(null)
  const [salidaForm, setSalidaForm] = useState(EMPTY_SALIDA_FORM)
  const [cerrarForm, setCerrarForm] = useState(EMPTY_CERRAR_FORM)
  const [manifestOrders, setManifestOrders] = useState([])
  const [entregaSelections, setEntregaSelections] = useState({})
  const [activatedOrders, setActivatedOrders] = useState(new Set())

  const [expandedManifestId, setExpandedManifestId] = useState(null)
  const [manifestDetails, setManifestDetails] = useState({})
  const [manifestDetailError, setManifestDetailError] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  useEffect(() => {
    if (!detailModalOpen || !detailRoute?.id_ruta) {
      return undefined
    }

    const intervalId = setInterval(async () => {
      if (isSubmitting) {
        return
      }

      try {
        const fullRoute = await getRouteRequest(detailRoute.id_ruta, token)
        setDetailRoute(fullRoute)

        if (expandedManifestId) {
          const order = await getOrderRequest(expandedManifestId, token)
          setManifestDetails((previous) => ({ ...previous, [expandedManifestId]: order }))
        }
      } catch {
        // sondeo silencioso: un fallo puntual no debe interrumpir la vista abierta
      }
    }, 5000)

    return () => clearInterval(intervalId)
  }, [detailModalOpen, detailRoute?.id_ruta, isSubmitting, expandedManifestId, token])

  const loadInitialData = async () => {
    setModuleError('')
    setIsLoading(true)

    try {
      const requests = [listRoutesRequest(token)]

      if (!isPiloto) {
        requests.push(listOrdersRequest(token), listVehiclesRequest(token), listAvailablePilotsRequest(token))
      }

      const [routesData, ordersData, vehiclesData, pilotosData] = await Promise.all(requests)

      setRoutes(Array.isArray(routesData) ? routesData : [])

      if (!isPiloto) {
        setPendingOrders((Array.isArray(ordersData) ? ordersData : []).filter((order) => order.estado === ORDER_PENDING_STATE))
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
        setPilotos(Array.isArray(pilotosData) ? pilotosData : [])
      }
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de entregas')
    } finally {
      setIsLoading(false)
    }
  }

  const gestionRoutes = routes.filter((route) => ROUTE_GESTION_STATES.has(route.estado))

  const consultaRoutes = useMemo(() => {
    const term = consultaSearchTerm.trim().toLowerCase()

    if (!term) {
      return routes
    }

    return routes.filter((route) =>
      `${route.id_ruta} ${route.vehiculo_placa || ''} ${route.piloto_nombre || ''} ${route.estado || ''}`
        .toLowerCase()
        .includes(term)
    )
  }, [routes, consultaSearchTerm])

  const visibleRoutes = viewMode === 'gestion' ? gestionRoutes : consultaRoutes

  const availableVehicles = vehicles.filter((vehicle) => vehicle.estado === VEHICLE_AVAILABLE_STATE)

  const sortedPendingOrders = useMemo(() => [...pendingOrders].sort(compareByZone), [pendingOrders])

  const openCreateModal = async () => {
    setCreateForm(EMPTY_CREATE_FORM)
    setSelectedOrderIds([])
    setModuleError('')
    setModuleNotice('')
    setCreateModalOpen(true)

    try {
      const pilotosData = await listAvailablePilotsRequest(token)
      setPilotos(Array.isArray(pilotosData) ? pilotosData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudieron actualizar los pilotos disponibles')
    }
  }

  const closeCreateModal = () => {
    if (isSubmitting) {
      return
    }

    setCreateModalOpen(false)
  }

  const handleCreateFieldChange = (event) => {
    const { name, value } = event.target
    setCreateForm((previous) => ({ ...previous, [name]: value }))
  }

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((previous) =>
      previous.includes(orderId) ? previous.filter((id) => id !== orderId) : [...previous, orderId]
    )
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')

    if (!createForm.id_vehiculo || !createForm.id_piloto) {
      setModuleError('Selecciona vehiculo y piloto')
      return
    }

    if (selectedOrderIds.length === 0) {
      setModuleError('Selecciona al menos un pedido para el manifiesto')
      return
    }

    setIsSubmitting(true)

    try {
      // Se envian en el mismo orden por zona que se ve en el selector, para que el
      // manifiesto de la entrega ya agrupe las paradas de una misma zona.
      const orderedPedidoIds = sortedPendingOrders
        .filter((order) => selectedOrderIds.includes(order.id_pedido))
        .map((order) => order.id_pedido)

      await createRouteRequest(
        {
          id_vehiculo: Number(createForm.id_vehiculo),
          id_piloto: Number(createForm.id_piloto),
          id_pedidos: orderedPedidoIds,
        },
        token
      )

      setModuleNotice('Entrega creada correctamente')
      notifySuccess('Entrega creada correctamente')
      setCreateModalOpen(false)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo crear la entrega'
      setModuleError(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openDetail = async (route) => {
    setDetailRoute(route)
    setDetailError('')
    setDetailModalOpen(true)
    setActiveAction(null)
    setExpandedManifestId(null)
    setManifestDetails({})
    setManifestDetailError('')

    try {
      const fullRoute = await getRouteRequest(route.id_ruta, token)
      setDetailRoute(fullRoute)
    } catch (error) {
      setDetailError(error.message || 'No se pudo cargar el detalle de la entrega')
    }
  }

  const closeDetail = () => {
    if (isSubmitting) {
      return
    }

    setDetailModalOpen(false)
    setDetailRoute(null)
    setActiveAction(null)
    setExpandedManifestId(null)
    setManifestDetails({})
  }

  const toggleManifestDetail = async (idPedido) => {
    if (expandedManifestId === idPedido) {
      setExpandedManifestId(null)
      return
    }

    setManifestDetailError('')
    setExpandedManifestId(idPedido)

    if (manifestDetails[idPedido]) {
      return
    }

    try {
      const order = await getOrderRequest(idPedido, token)
      setManifestDetails((previous) => ({ ...previous, [idPedido]: order }))
    } catch (error) {
      setManifestDetailError(error.message || 'No se pudo cargar el detalle del pedido')
    }
  }

  const refreshDetailRoute = async (id) => {
    const [updatedList, fullRoute] = await Promise.all([listRoutesRequest(token), getRouteRequest(id, token)])
    setRoutes(Array.isArray(updatedList) ? updatedList : [])
    setDetailRoute(fullRoute)
  }

  const openAction = async (action) => {
    setDetailError('')

    if (action === 'salida') {
      setSalidaForm(EMPTY_SALIDA_FORM)
    } else if (action === 'cerrar') {
      setCerrarForm(EMPTY_CERRAR_FORM)
    } else if (action === 'entregas') {
      try {
        const orderDetails = await Promise.all(
          (detailRoute.manifiesto || []).map((item) => getOrderRequest(item.id_pedido, token))
        )
        setManifestOrders(orderDetails)

        const selections = {}
        orderDetails.forEach((order) => {
          (order.lineas || []).forEach((linea) => {
            selections[linea.id_detalle] =
              linea.cantidad_entregada === null || linea.cantidad_entregada === undefined
                ? ''
                : String(linea.cantidad_entregada)
          })
        })
        setEntregaSelections(selections)
        setActivatedOrders(new Set())
      } catch (error) {
        setDetailError(error.message || 'No se pudieron cargar las lineas del manifiesto')
        return
      }
    }

    setActiveAction(action)
  }

  const closeAction = () => {
    if (isSubmitting) {
      return
    }

    setActiveAction(null)
  }

  const handleSalidaSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setIsSubmitting(true)

    try {
      await registerRouteDepartureRequest(
        detailRoute.id_ruta,
        {
          km_salida: Number(salidaForm.km_salida),
          galones_combustible: salidaForm.galones_combustible === '' ? undefined : Number(salidaForm.galones_combustible),
        },
        token
      )

      setActiveAction(null)
      notifySuccess('Salida registrada correctamente')
      await refreshDetailRoute(detailRoute.id_ruta)
    } catch (error) {
      const message = error.message || 'No se pudo registrar la salida'
      setDetailError(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEntregaCantidadChange = (idDetalle, value) => {
    setEntregaSelections((previous) => ({ ...previous, [idDetalle]: value }))
  }

  const isLineaLocked = (linea) => linea.estado_entrega !== ORDER_PENDING_STATE && !isAdmin

  const handleMarcarEntregaPedido = (idPedido) => {
    setActivatedOrders((previous) => new Set(previous).add(idPedido))
  }

  const handleEntregasSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')

    const activatedDetailIds = []
    manifestOrders.forEach((order) => {
      if (activatedOrders.has(order.id_pedido)) {
        (order.lineas || []).forEach((linea) => activatedDetailIds.push(linea.id_detalle))
      }
    })

    if (activatedDetailIds.length === 0) {
      setDetailError('Marca al menos un pedido con "Marcar entrega" antes de guardar')
      return
    }

    const entregas = []

    for (const idDetalle of activatedDetailIds) {
      const value = entregaSelections[idDetalle]

      if (value === undefined || value === '') {
        setDetailError('Completa la cantidad entregada de cada linea del pedido marcado')
        return
      }

      const cantidadEntregada = Number(value)

      if (!Number.isFinite(cantidadEntregada) || cantidadEntregada < 0) {
        setDetailError('La cantidad entregada debe ser un numero valido')
        return
      }

      entregas.push({ id_detalle: idDetalle, cantidad_entregada: cantidadEntregada })
    }

    setIsSubmitting(true)

    try {
      await confirmRouteDeliveriesRequest(detailRoute.id_ruta, { entregas }, token)

      setActiveAction(null)
      notifySuccess('Entregas confirmadas correctamente')
      await refreshDetailRoute(detailRoute.id_ruta)
    } catch (error) {
      const message = error.message || 'No se pudieron confirmar las entregas'
      setDetailError(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCerrarSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setIsSubmitting(true)

    try {
      await closeRouteRequest(detailRoute.id_ruta, { km_llegada: Number(cerrarForm.km_llegada) }, token)

      setActiveAction(null)
      setModuleNotice(`Entrega #${detailRoute.id_ruta} cerrada correctamente`)
      notifySuccess(`Entrega #${detailRoute.id_ruta} cerrada correctamente`)
      setDetailModalOpen(false)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo cerrar la entrega'
      setDetailError(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de entregas">
      <ReloadButton onClick={loadInitialData} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Entregas</h3>
          <p>
            {isPiloto
              ? 'Tus entregas asignadas: registra salida, confirma entregas y cierra la entrega.'
              : 'Arma manifiestos de entrega, asigna vehiculo y piloto, y da seguimiento al ciclo de vida de cada entrega.'}
          </p>
        </div>
        <div className="provider-form-actions">
          {!isPiloto ? (
            <button type="button" onClick={openCreateModal}>
              Agregar entrega
            </button>
          ) : null}
        </div>
      </div>

      <div className="maturation-tab-strip" role="tablist" aria-label="Vista de entregas">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'gestion'}
          className={`secondary-button maturation-tab-button ${viewMode === 'gestion' ? 'is-active' : ''}`}
          onClick={() => setViewMode('gestion')}
        >
          Gestion
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'consultar'}
          className={`secondary-button maturation-tab-button ${viewMode === 'consultar' ? 'is-active' : ''}`}
          onClick={() => setViewMode('consultar')}
        >
          Consultar
        </button>
      </div>

      {viewMode === 'consultar' ? (
        <div className="maturation-filter-panel">
          <div className="maturation-filter-grid">
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Buscar</span>
              <input
                type="text"
                value={consultaSearchTerm}
                onChange={(event) => setConsultaSearchTerm(event.target.value)}
                placeholder="#entrega, placa, piloto o estado"
                className="maturation-filter-input"
              />
            </label>
          </div>
        </div>
      ) : null}

      {moduleError ? <p className="feedback error">{moduleError}</p> : null}
      {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Entrega</th>
              <th>Vehiculo</th>
              <th>Piloto</th>
              <th>Estado</th>
              <th>Km salida</th>
              <th>Km llegada</th>
              <th>Fecha salida</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRoutes.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  {viewMode === 'gestion' ? 'No hay entregas activas.' : 'No hay entregas registradas.'}
                </td>
              </tr>
            ) : null}

            {visibleRoutes.map((route) => (
              <tr key={route.id_ruta}>
                <td>#{route.id_ruta}</td>
                <td>{route.vehiculo_placa || `#${route.id_vehiculo}`}</td>
                <td>{route.piloto_nombre || `#${route.id_piloto}`}</td>
                <td>{route.estado}</td>
                <td>{formatNumber(route.km_salida)}</td>
                <td>{formatNumber(route.km_llegada)}</td>
                <td>{formatDateTime(route.fecha_salida)}</td>
                <td className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => openDetail(route)}>
                    Gestionar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Nueva entrega</h4>
                <p style={{ margin: 0 }}>Selecciona pedidos pendientes, vehiculo y piloto.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeCreateModal}>
                Cerrar
              </button>
            </div>

            {moduleError ? <p className="feedback error">{moduleError}</p> : null}

            <form className="provider-form" onSubmit={handleCreateSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Vehiculo (Disponible) *
                  <select name="id_vehiculo" value={createForm.id_vehiculo} onChange={handleCreateFieldChange} required>
                    <option value="">Selecciona vehiculo</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                        {vehicle.placa} - {vehicle.modelo}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Piloto sugerido *
                  <select name="id_piloto" value={createForm.id_piloto} onChange={handleCreateFieldChange} required>
                    <option value="">Selecciona piloto</option>
                    {pilotos.map((piloto) => (
                      <option key={piloto.id_usuario} value={piloto.id_usuario}>
                        {piloto.nombre_completo} (entregas hoy: {piloto.rutas_hoy})
                      </option>
                    ))}
                  </select>
                  <small>Ordenados por menor carga de entregas asignadas hoy.</small>
                </label>
              </div>

              <div style={{ width: '100%', marginTop: 8 }}>
                <h4>Pedidos pendientes</h4>
                <p style={{ margin: '0 0 8px' }}>
                  Ordenados por ubicacion para facilitar seleccionar entregas de la misma zona.
                </p>
                <div className="providers-table-wrap table-limited">
                  <table className="providers-table">
                    <thead>
                      <tr>
                        <th>Sel.</th>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Ubicacion</th>
                        <th>Lineas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPendingOrders.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-table-cell">No hay pedidos pendientes.</td>
                        </tr>
                      ) : null}
                      {sortedPendingOrders.map((order) => (
                        <tr key={order.id_pedido}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id_pedido)}
                              onChange={() => toggleOrderSelection(order.id_pedido)}
                            />
                          </td>
                          <td>#{order.id_pedido}</td>
                          <td>{order.nombre_comercial || `Cliente #${order.id_cliente}`}</td>
                          <td>{formatUbicacion(order)}</td>
                          <td>{(order.lineas || []).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Crear entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailModalOpen && detailRoute ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <ModalCloseButton onClick={closeDetail} disabled={isSubmitting} />
            <div style={{ paddingRight: 46 }}>
              <h4 style={{ marginBottom: 4 }}>Entrega #{detailRoute.id_ruta}</h4>
              <p style={{ margin: 0 }}>
                {detailRoute.vehiculo_placa} · {detailRoute.piloto_nombre} · {detailRoute.estado}
              </p>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <div className="provider-form-actions" style={{ marginTop: '12px' }}>
              {detailRoute.estado === ROUTE_PREPARADO_STATE ? (
                <button type="button" onClick={() => openAction('salida')}>
                  Registrar salida
                </button>
              ) : null}
              {detailRoute.estado === ROUTE_EN_RUTA_STATE ? (
                <button type="button" onClick={() => openAction('entregas')}>
                  Confirmar entregas
                </button>
              ) : null}
              {detailRoute.estado === ROUTE_EN_RUTA_STATE ? (
                <button type="button" className="secondary-button" onClick={() => openAction('cerrar')}>
                  Cerrar entrega
                </button>
              ) : null}
            </div>

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Manifiesto</h4>
            <p style={{ margin: '0 0 8px' }}>Consulta el detalle de cada pedido y del cliente que lo recibe.</p>
            {manifestDetailError ? <p className="feedback error">{manifestDetailError}</p> : null}
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailRoute.manifiesto || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-table-cell">Sin pedidos en el manifiesto.</td>
                    </tr>
                  ) : null}
                  {(detailRoute.manifiesto || []).map((item) => {
                    const isExpanded = expandedManifestId === item.id_pedido
                    const orderDetail = manifestDetails[item.id_pedido]

                    return (
                      <Fragment key={item.id_pedido}>
                        <tr>
                          <td>#{item.id_pedido}</td>
                          <td>{item.nombre_comercial || `Cliente #${item.id_cliente}`}</td>
                          <td>{computeManifestStatus(item)}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => toggleManifestDetail(item.id_pedido)}
                            >
                              {isExpanded ? 'Ocultar' : 'Ver detalle'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan="4">
                              {!orderDetail ? (
                                <p style={{ margin: 0 }}>Cargando detalle...</p>
                              ) : (
                                <div className="maturation-filter-panel">
                                  <strong>{orderDetail.nombre_comercial || `Cliente #${orderDetail.id_cliente}`}</strong>
                                  {orderDetail.direccion_entrega ? (
                                    <p style={{ margin: '4px 0 0' }}>Direccion: {orderDetail.direccion_entrega}</p>
                                  ) : null}
                                  {orderDetail.telefono ? (
                                    <p style={{ margin: '4px 0 0' }}>Telefono: {orderDetail.telefono}</p>
                                  ) : null}
                                  {orderDetail.observaciones ? (
                                    <p style={{ margin: '4px 0 0' }}>Observaciones: {orderDetail.observaciones}</p>
                                  ) : null}

                                  <div className="providers-table-wrap" style={{ marginTop: 10 }}>
                                    <table className="providers-table">
                                      <thead>
                                        <tr>
                                          <th>Producto</th>
                                          <th>Cantidad pedida</th>
                                          <th>Cantidad entregada</th>
                                          <th>Entrega</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(orderDetail.lineas || []).map((linea) => (
                                          <tr key={linea.id_detalle}>
                                            <td>{linea.producto_nombre || `Producto #${linea.id_producto}`}</td>
                                            <td>{formatNumber(linea.cantidad)}</td>
                                            <td>{linea.cantidad_entregada === null || linea.cantidad_entregada === undefined ? '-' : formatNumber(linea.cantidad_entregada)}</td>
                                            <td>{linea.estado_entrega}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeAction === 'salida' && detailRoute ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Registrar salida · Entrega #{detailRoute.id_ruta}</h4>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleSalidaSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Km salida *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salidaForm.km_salida}
                    onChange={(event) => setSalidaForm((previous) => ({ ...previous, km_salida: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Galones combustible
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salidaForm.galones_combustible}
                    onChange={(event) =>
                      setSalidaForm((previous) => ({ ...previous, galones_combustible: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Registrar salida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeAction === 'entregas' && detailRoute ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Confirmar entregas · Entrega #{detailRoute.id_ruta}</h4>
                <p style={{ margin: 0 }}>
                  Indica cuanto se entrego de cada linea. Lo que falte queda disponible para devolucion.
                  {!isAdmin ? ' Una linea ya procesada solo la puede modificar un administrador.' : ''}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleEntregasSubmit} style={{ marginTop: '16px' }}>
              {manifestOrders.map((order) => {
                const activated = activatedOrders.has(order.id_pedido)
                const lineas = order.lineas || []
                const hasEditableLineas = lineas.some((linea) => !isLineaLocked(linea))
                const buttonLabel = !hasEditableLineas
                  ? 'Entrega ya confirmada'
                  : activated
                    ? 'Entrega marcada'
                    : 'Marcar entrega'

                return (
                <div key={order.id_pedido} style={{ width: '100%', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ marginBottom: 4 }}>
                      Pedido #{order.id_pedido} - {order.nombre_comercial || `Cliente #${order.id_cliente}`}
                    </h4>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleMarcarEntregaPedido(order.id_pedido)}
                      disabled={!hasEditableLineas || activated}
                    >
                      {buttonLabel}
                    </button>
                  </div>
                  <div className="providers-table-wrap table-limited">
                    <table className="providers-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad pedida</th>
                          <th>Cantidad entregada</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.map((linea) => {
                          const locked = isLineaLocked(linea)
                          const disabled = locked || !activated

                          return (
                            <tr key={linea.id_detalle}>
                              <td>{linea.producto_nombre || `Producto #${linea.id_producto}`}</td>
                              <td>{formatNumber(linea.cantidad)}</td>
                              <td>
                                {locked ? (
                                  <span>
                                    {linea.cantidad_entregada === null || linea.cantidad_entregada === undefined
                                      ? '-'
                                      : formatNumber(linea.cantidad_entregada)}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    max={linea.cantidad}
                                    step="0.01"
                                    value={entregaSelections[linea.id_detalle] ?? ''}
                                    onChange={(event) => handleEntregaCantidadChange(linea.id_detalle, event.target.value)}
                                    disabled={disabled}
                                    className="maturation-filter-input"
                                    style={{ width: 100 }}
                                    title={!activated ? 'Presiona "Marcar entrega" para habilitar este pedido' : undefined}
                                  />
                                )}
                              </td>
                              <td>{linea.estado_entrega}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                )
              })}

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar entregas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeAction === 'cerrar' && detailRoute ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Cerrar entrega #{detailRoute.id_ruta}</h4>
                <p style={{ margin: 0 }}>Km salida: {formatNumber(detailRoute.km_salida)}</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleCerrarSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Km llegada *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cerrarForm.km_llegada}
                    onChange={(event) => setCerrarForm({ km_llegada: event.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Cerrar entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default RoutesModule
