import { useEffect, useMemo, useState } from 'react'
import { listClientsRequest } from '../../services/client.service'
import { listProductsRequest } from '../../services/product.service'
import { listExistenciasByProductRequest } from '../../services/inventory.service'
import {
  cancelOrderRequest,
  createOrderRequest,
  getMejoresClientesReportRequest,
  getProductosMasVendidosReportRequest,
  listOrdersRequest,
  updateOrderFechaEntregaRequest,
} from '../../services/order.service'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const FINISHED_PRODUCT_TYPE = 'Producto Terminado'
const ORDER_PENDING_STATE = 'Pendiente'
const GESTION_ORDER_STATES = new Set(['Pendiente', 'Preparado', 'En Ruta', 'Con Devolucion'])

const EMPTY_ORDER_FORM = { id_cliente: '', observaciones: '', fecha_entrega_programada: '' }
const ORDER_RESOLVED_STATES = new Set(['Entregado', 'Con Devolucion', 'Cancelado'])
const EMPTY_LINE_FORM = { id_producto: '', cantidad: '', id_existencia: '' }

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-GT') : '-')
const formatDateOnly = (value) => (value ? new Date(value).toLocaleDateString('es-GT') : '-')

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCurrentMonthRange = () => {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { desde: toDateInputValue(firstDay), hasta: toDateInputValue(lastDay) }
}

function OrdersModule({ token, isActive }) {
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [viewMode, setViewMode] = useState('gestion')
  const [consultaSearchTerm, setConsultaSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM)
  const [lineForm, setLineForm] = useState(EMPTY_LINE_FORM)
  const [lineas, setLineas] = useState([])
  const [productExistencias, setProductExistencias] = useState([])
  const [isLoadingExistencias, setIsLoadingExistencias] = useState(false)

  const [detailOrder, setDetailOrder] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editFechaEntrega, setEditFechaEntrega] = useState('')
  const [isSavingFechaEntrega, setIsSavingFechaEntrega] = useState(false)

  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmModalConfig, setConfirmModalConfig] = useState({ title: '', message: '', onConfirm: null })

  const [reportFilters, setReportFilters] = useState(() => ({ ...getCurrentMonthRange(), id_cliente: '' }))
  const [productosMasVendidos, setProductosMasVendidos] = useState([])
  const [mejoresClientes, setMejoresClientes] = useState([])
  const [isReportLoading, setIsReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadInitialData = async () => {
    setModuleError('')
    setIsLoading(true)

    try {
      const [ordersData, clientsData, productsData] = await Promise.all([
        listOrdersRequest(token),
        listClientsRequest(token),
        listProductsRequest(token),
      ])

      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setClients(Array.isArray(clientsData) ? clientsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de pedidos')
    } finally {
      setIsLoading(false)
    }
  }

  const loadReports = async (overrideFilters) => {
    setReportError('')
    setIsReportLoading(true)

    try {
      const source = overrideFilters || reportFilters
      const filters = {
        desde: source.desde || undefined,
        hasta: source.hasta || undefined,
        id_cliente: source.id_cliente || undefined,
      }

      const [masVendidosData, mejoresClientesData] = await Promise.all([
        getProductosMasVendidosReportRequest(filters, token),
        getMejoresClientesReportRequest(filters, token),
      ])

      setProductosMasVendidos(Array.isArray(masVendidosData) ? masVendidosData : [])
      setMejoresClientes(Array.isArray(mejoresClientesData) ? mejoresClientesData : [])
    } catch (error) {
      setReportError(error.message || 'No se pudieron cargar los reportes')
    } finally {
      setIsReportLoading(false)
    }
  }

  useEffect(() => {
    if (isActive && viewMode === 'reportes') {
      // Se difiere a un microtask para que el efecto no dispare setState de forma sincrona.
      Promise.resolve().then(() => loadReports())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, viewMode])

  const handleReportFilterChange = (event) => {
    const { name, value } = event.target
    setReportFilters((previous) => ({ ...previous, [name]: value }))
  }

  const handleReportFilterSubmit = (event) => {
    event.preventDefault()
    loadReports()
  }

  const handleClearReportFilters = () => {
    const cleared = { ...getCurrentMonthRange(), id_cliente: '' }
    setReportFilters(cleared)
    loadReports(cleared)
  }

  const finishedProducts = products.filter((product) => product.tipo_producto === FINISHED_PRODUCT_TYPE)

  const gestionOrders = orders.filter((order) => GESTION_ORDER_STATES.has(order.estado))

  const consultaOrders = useMemo(() => {
    const term = consultaSearchTerm.trim().toLowerCase()

    if (!term) {
      return orders
    }

    return orders.filter((order) =>
      `${order.id_pedido} ${order.nombre_comercial || ''} ${order.estado || ''}`.toLowerCase().includes(term)
    )
  }, [orders, consultaSearchTerm])

  const switchToGestionView = () => setViewMode('gestion')

  const openOrderModal = () => {
    setOrderForm(EMPTY_ORDER_FORM)
    setLineForm(EMPTY_LINE_FORM)
    setLineas([])
    setProductExistencias([])
    setModuleError('')
    setModuleNotice('')
    setOrderModalOpen(true)
  }

  const closeOrderModal = () => {
    if (isSubmitting) {
      return
    }

    setOrderModalOpen(false)
  }

  const handleOrderFieldChange = (event) => {
    const { name, value } = event.target
    setOrderForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleLineFieldChange = async (event) => {
    const { name, value } = event.target
    setLineForm((previous) => ({ ...previous, [name]: value }))

    if (name === 'id_producto') {
      setLineForm((previous) => ({ ...previous, id_existencia: '' }))
      setProductExistencias([])

      if (!value) {
        return
      }

      setIsLoadingExistencias(true)

      try {
        const existencias = await listExistenciasByProductRequest(Number(value), token)
        setProductExistencias(Array.isArray(existencias) ? existencias : [])
      } catch (error) {
        notifyError(error.message || 'No se pudieron cargar los lotes disponibles')
      } finally {
        setIsLoadingExistencias(false)
      }
    }
  }

  const describeLote = (idExistencia) => {
    if (!idExistencia) {
      return 'Automatico (lote mas antiguo)'
    }

    const existencia = productExistencias.find((item) => item.id_existencia === idExistencia)
    return existencia
      ? `Vence ${formatDateOnly(existencia.fecha_vencimiento)} · ${formatNumber(existencia.cantidad_disponible)} disp.`
      : `Lote #${idExistencia}`
  }

  const handleAddLine = () => {
    const productId = Number(lineForm.id_producto)
    const cantidad = Number(lineForm.cantidad)
    const idExistencia = lineForm.id_existencia ? Number(lineForm.id_existencia) : null

    if (!productId || Number.isNaN(cantidad) || cantidad <= 0) {
      setModuleError('Selecciona un producto y una cantidad valida para agregar la linea')
      return
    }

    const product = finishedProducts.find((item) => item.id_producto === productId)

    setModuleError('')
    setLineas((previous) => {
      const existingIndex = previous.findIndex(
        (linea) => linea.id_producto === productId && linea.id_existencia === idExistencia
      )

      if (existingIndex !== -1) {
        return previous.map((linea, index) =>
          index === existingIndex ? { ...linea, cantidad: linea.cantidad + cantidad } : linea
        )
      }

      return [
        ...previous,
        {
          id_producto: productId,
          producto_nombre: product?.nombre || `Producto #${productId}`,
          cantidad,
          id_existencia: idExistencia,
          lote_label: describeLote(idExistencia),
        },
      ]
    })
    setLineForm(EMPTY_LINE_FORM)
    setProductExistencias([])
  }

  const handleRemoveLine = (index) => {
    setLineas((previous) => previous.filter((_, i) => i !== index))
  }

  const handleOrderSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')

    if (!orderForm.id_cliente) {
      setModuleError('Selecciona un cliente')
      return
    }

    if (lineas.length === 0) {
      setModuleError('Agrega al menos una linea de producto')
      return
    }

    setIsSubmitting(true)

    try {
      await createOrderRequest(
        {
          id_cliente: Number(orderForm.id_cliente),
          observaciones: orderForm.observaciones || undefined,
          fecha_entrega_programada: orderForm.fecha_entrega_programada || undefined,
          lineas: lineas.map((linea) => ({
            id_producto: linea.id_producto,
            cantidad: linea.cantidad,
            id_existencia: linea.id_existencia || undefined,
          })),
        },
        token
      )

      setModuleNotice('Pedido registrado correctamente')
      notifySuccess('Pedido registrado correctamente')
      setOrderModalOpen(false)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo registrar el pedido'
      setModuleError(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openOrderDetail = (order) => {
    setDetailOrder(order)
    setEditFechaEntrega(order.fecha_entrega_programada ? String(order.fecha_entrega_programada).slice(0, 10) : '')
    setDetailModalOpen(true)
  }

  const closeOrderDetail = () => {
    if (isSavingFechaEntrega) {
      return
    }

    setDetailModalOpen(false)
    setDetailOrder(null)
  }

  const handleSaveFechaEntrega = async () => {
    setIsSavingFechaEntrega(true)

    try {
      const updated = await updateOrderFechaEntregaRequest(detailOrder.id_pedido, editFechaEntrega || null, token)
      setDetailOrder(updated)
      setOrders((previous) => previous.map((order) => (order.id_pedido === updated.id_pedido ? updated : order)))
      notifySuccess('Fecha de entrega actualizada')
    } catch (error) {
      notifyError(error.message || 'No se pudo actualizar la fecha de entrega')
    } finally {
      setIsSavingFechaEntrega(false)
    }
  }

  const closeConfirmModal = () => {
    setConfirmModalOpen(false)
    setConfirmModalConfig({ title: '', message: '', onConfirm: null })
  }

  const handleCancelOrder = (order) => {
    setConfirmModalConfig({
      title: 'Cancelar pedido',
      message: `Estas seguro de cancelar el pedido #${order.id_pedido}?`,
      onConfirm: async () => {
        setConfirmModalOpen(false)
        setModuleError('')
        setModuleNotice('')

        try {
          await cancelOrderRequest(order.id_pedido, token)
          setModuleNotice(`Pedido #${order.id_pedido} cancelado correctamente`)
          notifySuccess(`Pedido #${order.id_pedido} cancelado correctamente`)
          await loadInitialData()
        } catch (error) {
          const message = error.message || 'No se pudo cancelar el pedido'
          setModuleError(message)
          notifyError(message)
        }
      },
    })
    setConfirmModalOpen(true)
  }

  const visibleOrders = viewMode === 'gestion' ? gestionOrders : consultaOrders

  return (
    <section className="panel-card" aria-label="Modulo de pedidos">
      <ReloadButton onClick={loadInitialData} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Pedidos</h3>
          <p>Registra la lista de despacho por cliente. No incluye facturacion ni ventas.</p>
        </div>
        <div className="provider-form-actions">
          <button type="button" onClick={openOrderModal}>
            Agregar pedido
          </button>
        </div>
      </div>

      <div className="maturation-tab-strip" role="tablist" aria-label="Vista de pedidos">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'gestion'}
          className={`secondary-button maturation-tab-button ${viewMode === 'gestion' ? 'is-active' : ''}`}
          onClick={switchToGestionView}
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
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'reportes'}
          className={`secondary-button maturation-tab-button ${viewMode === 'reportes' ? 'is-active' : ''}`}
          onClick={() => setViewMode('reportes')}
        >
          Reportes
        </button>
      </div>

      {viewMode === 'reportes' ? (
        <>
          <form className="maturation-filter-panel" onSubmit={handleReportFilterSubmit}>
            <div className="maturation-filter-grid">
              <label className="maturation-filter-field">
                <span className="maturation-filter-label">Cliente</span>
                <select
                  name="id_cliente"
                  value={reportFilters.id_cliente}
                  onChange={handleReportFilterChange}
                  className="maturation-filter-input"
                >
                  <option value="">Todos los clientes</option>
                  {clients.map((client) => (
                    <option key={client.id_cliente} value={client.id_cliente}>
                      {client.nombre_comercial || `Cliente #${client.id_cliente}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="maturation-filter-field">
                <span className="maturation-filter-label">Desde</span>
                <input
                  type="date"
                  name="desde"
                  value={reportFilters.desde}
                  onChange={handleReportFilterChange}
                  className="maturation-filter-input"
                />
              </label>
              <label className="maturation-filter-field">
                <span className="maturation-filter-label">Hasta</span>
                <input
                  type="date"
                  name="hasta"
                  value={reportFilters.hasta}
                  onChange={handleReportFilterChange}
                  className="maturation-filter-input"
                />
              </label>
            </div>
            <div className="maturation-filter-actions">
              <button type="button" className="secondary-button" onClick={handleClearReportFilters}>
                Limpiar filtros
              </button>
              <button type="submit" disabled={isReportLoading}>
                {isReportLoading ? 'Cargando...' : 'Aplicar filtros'}
              </button>
            </div>
          </form>

          {reportError ? <p className="feedback error">{reportError}</p> : null}

          <div className="maturation-section-divider" aria-hidden="true" />

          <h4>Productos mas vendidos</h4>
          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad vendida</th>
                  <th>Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {productosMasVendidos.length === 0 && !isReportLoading ? (
                  <tr>
                    <td colSpan="3" className="empty-table-cell">Sin datos para los filtros seleccionados.</td>
                  </tr>
                ) : null}
                {productosMasVendidos.map((row) => (
                  <tr key={row.id_producto}>
                    <td>{row.producto_nombre || `Producto #${row.id_producto}`}</td>
                    <td>
                      {formatNumber(row.cantidad_total)} {row.unidad_medida || ''}
                    </td>
                    <td>{row.total_pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4>Mejores compradores</h4>
          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pedidos</th>
                  <th>Cantidad total</th>
                </tr>
              </thead>
              <tbody>
                {mejoresClientes.length === 0 && !isReportLoading ? (
                  <tr>
                    <td colSpan="3" className="empty-table-cell">Sin datos para los filtros seleccionados.</td>
                  </tr>
                ) : null}
                {mejoresClientes.map((row) => (
                  <tr key={row.id_cliente}>
                    <td>{row.nombre_comercial || `Cliente #${row.id_cliente}`}</td>
                    <td>{row.total_pedidos}</td>
                    <td>{formatNumber(row.cantidad_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {viewMode === 'consultar' ? (
        <div className="maturation-filter-panel">
          <div className="maturation-filter-grid">
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Buscar</span>
              <input
                type="text"
                value={consultaSearchTerm}
                onChange={(event) => setConsultaSearchTerm(event.target.value)}
                placeholder="#pedido, cliente o estado"
                className="maturation-filter-input"
              />
            </label>
          </div>
        </div>
      ) : null}

      {viewMode !== 'reportes' ? (
        <>
          {moduleError ? <p className="feedback error">{moduleError}</p> : null}
          {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Lineas</th>
                  <th>Ruta</th>
                  <th>Fecha</th>
                  <th>Entrega programada</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan="8" className="empty-table-cell">
                      {viewMode === 'gestion' ? 'No hay pedidos activos.' : 'No hay pedidos registrados.'}
                    </td>
                  </tr>
                ) : null}

                {visibleOrders.map((order) => (
                  <tr key={order.id_pedido}>
                    <td>#{order.id_pedido}</td>
                    <td>{order.nombre_comercial || `Cliente #${order.id_cliente}`}</td>
                    <td>{order.estado}</td>
                    <td>{(order.lineas || []).length}</td>
                    <td>{order.id_ruta_actual ? `#${order.id_ruta_actual} (${order.ruta_estado})` : '-'}</td>
                    <td>{formatDateTime(order.fecha_creacion)}</td>
                    <td>{formatDateOnly(order.fecha_entrega_programada)}</td>
                    <td className="table-actions">
                      <button type="button" className="secondary-button" onClick={() => openOrderDetail(order)}>
                        Ver detalle
                      </button>
                      {order.estado === ORDER_PENDING_STATE ? (
                        <button type="button" className="danger-button" onClick={() => handleCancelOrder(order)}>
                          Cancelar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {orderModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Nuevo pedido</h4>
                <p style={{ margin: 0 }}>Selecciona el cliente y agrega las lineas de producto.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeOrderModal}>
                Cerrar
              </button>
            </div>

            {moduleError ? <p className="feedback error">{moduleError}</p> : null}

            <form className="provider-form" onSubmit={handleOrderSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Cliente *
                  <select name="id_cliente" value={orderForm.id_cliente} onChange={handleOrderFieldChange} required>
                    <option value="">Selecciona cliente</option>
                    {clients.map((client) => (
                      <option key={client.id_cliente} value={client.id_cliente}>
                        {client.nombre_comercial || `Cliente #${client.id_cliente}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Fecha de entrega
                  <input
                    name="fecha_entrega_programada"
                    type="date"
                    value={orderForm.fecha_entrega_programada}
                    onChange={handleOrderFieldChange}
                  />
                </label>

                <label>
                  Observaciones
                  <input
                    name="observaciones"
                    type="text"
                    value={orderForm.observaciones}
                    onChange={handleOrderFieldChange}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <div style={{ width: '100%', marginTop: 8 }}>
                <h4>Lineas de producto</h4>
                <div className="provider-form-grid">
                  <label>
                    Producto
                    <select name="id_producto" value={lineForm.id_producto} onChange={handleLineFieldChange}>
                      <option value="">Selecciona producto terminado</option>
                      {finishedProducts.map((product) => (
                        <option key={product.id_producto} value={product.id_producto}>
                          {product.nombre || `Producto #${product.id_producto}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Cantidad
                    <input
                      name="cantidad"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={lineForm.cantidad}
                      onChange={handleLineFieldChange}
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Lote
                    <select
                      name="id_existencia"
                      value={lineForm.id_existencia}
                      onChange={handleLineFieldChange}
                      disabled={!lineForm.id_producto || isLoadingExistencias}
                    >
                      <option value="">Automatico (lote mas antiguo)</option>
                      {productExistencias.map((existencia) => (
                        <option key={existencia.id_existencia} value={existencia.id_existencia}>
                          Vence {formatDateOnly(existencia.fecha_vencimiento)} · {formatNumber(existencia.cantidad_disponible)} disp.
                          {existencia.nombre_empresa ? ` · ${existencia.nombre_empresa}` : ''}
                        </option>
                      ))}
                    </select>
                    {isLoadingExistencias ? <small>Cargando lotes disponibles...</small> : null}
                  </label>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button type="button" className="secondary-button" onClick={handleAddLine}>
                    Añadir linea
                  </button>
                </div>

                {lineas.length > 0 ? (
                  <div className="providers-table-wrap" style={{ marginTop: 8 }}>
                    <table className="providers-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Lote</th>
                          <th>Cantidad</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.map((linea, index) => (
                          <tr key={`linea-${index}`}>
                            <td>{linea.producto_nombre}</td>
                            <td>{linea.lote_label}</td>
                            <td>{formatNumber(linea.cantidad)}</td>
                            <td>
                              <button type="button" className="danger-button" onClick={() => handleRemoveLine(index)}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Registrar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailModalOpen && detailOrder ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Pedido #{detailOrder.id_pedido}</h4>
                <p style={{ margin: 0 }}>
                  {detailOrder.nombre_comercial || `Cliente #${detailOrder.id_cliente}`} · {detailOrder.estado}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeOrderDetail}>
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label>
                Fecha de entrega
                <input
                  type="date"
                  value={editFechaEntrega}
                  onChange={(event) => setEditFechaEntrega(event.target.value)}
                  disabled={ORDER_RESOLVED_STATES.has(detailOrder.estado) || isSavingFechaEntrega}
                />
              </label>
              {!ORDER_RESOLVED_STATES.has(detailOrder.estado) ? (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginLeft: 8 }}
                  onClick={handleSaveFechaEntrega}
                  disabled={isSavingFechaEntrega}
                >
                  {isSavingFechaEntrega ? 'Guardando...' : 'Guardar fecha'}
                </button>
              ) : null}
            </div>

            <div className="providers-table-wrap table-limited" style={{ marginTop: 12 }}>
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Lote</th>
                    <th>Cantidad</th>
                    <th>Estado entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailOrder.lineas || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-table-cell">Sin lineas registradas.</td>
                    </tr>
                  ) : null}
                  {(detailOrder.lineas || []).map((linea) => (
                    <tr key={linea.id_detalle}>
                      <td>{linea.producto_nombre || `Producto #${linea.id_producto}`}</td>
                      <td>
                        {linea.id_existencia
                          ? `Lote #${linea.id_existencia} · Vence ${formatDateOnly(linea.existencia_fecha_vencimiento)}`
                          : '-'}
                      </td>
                      <td>{formatNumber(linea.cantidad)}</td>
                      <td>{linea.estado_entrega}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detailOrder.observaciones ? <p style={{ marginTop: 8 }}>Observaciones: {detailOrder.observaciones}</p> : null}
          </div>
        </div>
      ) : null}

      {confirmModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: 'min(560px, 100%)' }}>
            <h4 style={{ marginTop: 0 }}>{confirmModalConfig.title}</h4>
            <p style={{ marginTop: 0 }}>{confirmModalConfig.message}</p>

            <div className="provider-form-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-button" onClick={closeConfirmModal}>
                Cancelar
              </button>
              <button type="button" className="danger-button" onClick={confirmModalConfig.onConfirm}>
                Si, cancelar pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default OrdersModule
