import { useEffect, useMemo, useState } from 'react'
import {
  createOrderReturnRequest,
  listOrderReturnsRequest,
  listPendingReceptionLinesRequest,
  listPendingReviewReturnsRequest,
  resolveOrderReturnRequest,
} from '../../services/order_return.service'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const RESOLUTION_REINGRESADO = 'Reingresado a inventario'
const RESOLUTION_PERDIDA = 'Perdida'
const RECEPTION_ROLES = new Set(['Administrador', 'Logistica'])
const RESOLUTION_ROLES = new Set(['Administrador', 'Logistica', 'Produccion'])

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-GT') : '-')

function ReturnsModule({ token, isActive, roleName }) {
  const canReceive = RECEPTION_ROLES.has(roleName)
  const canResolve = RESOLUTION_ROLES.has(roleName)

  const [pendingLines, setPendingLines] = useState([])
  const [pendingReview, setPendingReview] = useState([])
  const [allReturns, setAllReturns] = useState([])
  const [viewMode, setViewMode] = useState('gestion')
  const [consultaSearchTerm, setConsultaSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

  const [receptionModalOpen, setReceptionModalOpen] = useState(false)
  const [receptionLine, setReceptionLine] = useState(null)
  const [receptionForm, setReceptionForm] = useState({ cantidad_devuelta: '', motivo: '' })

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
      const [pendingLinesData, pendingReviewData, allReturnsData] = await Promise.all([
        listPendingReceptionLinesRequest(token),
        listPendingReviewReturnsRequest(token),
        listOrderReturnsRequest(token),
      ])

      setPendingLines(Array.isArray(pendingLinesData) ? pendingLinesData : [])
      setPendingReview(Array.isArray(pendingReviewData) ? pendingReviewData : [])
      setAllReturns(Array.isArray(allReturnsData) ? allReturnsData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de devoluciones')
    } finally {
      setIsLoading(false)
    }
  }

  const consultaReturns = useMemo(() => {
    const term = consultaSearchTerm.trim().toLowerCase()

    if (!term) {
      return allReturns
    }

    return allReturns.filter((item) =>
      `${item.id_devolucion} ${item.producto_nombre || ''} ${item.nombre_comercial || ''} ${item.resolucion || ''} ${item.piloto_nombre || ''}`
        .toLowerCase()
        .includes(term)
    )
  }, [allReturns, consultaSearchTerm])

  const openReceptionModal = (line) => {
    const cantidadNoEntregada =
      line.cantidad_entregada === null || line.cantidad_entregada === undefined
        ? line.cantidad
        : Number(line.cantidad) - Number(line.cantidad_entregada)

    setReceptionLine(line)
    setReceptionForm({ cantidad_devuelta: cantidadNoEntregada, motivo: '' })
    setModuleError('')
    setModuleNotice('')
    setReceptionModalOpen(true)
  }

  const closeReceptionModal = () => {
    if (isSubmitting) {
      return
    }

    setReceptionModalOpen(false)
    setReceptionLine(null)
  }

  const handleReceptionSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmitting(true)

    try {
      await createOrderReturnRequest(
        {
          id_detalle: receptionLine.id_detalle,
          cantidad_devuelta: Number(receptionForm.cantidad_devuelta),
          motivo: receptionForm.motivo || undefined,
        },
        token
      )

      setModuleNotice('Devolucion recibida correctamente, queda pendiente de revision')
      notifySuccess('Devolucion recibida correctamente')
      setReceptionModalOpen(false)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo registrar la recepcion'
      setModuleError(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolve = async (devolucion, resolucion) => {
    setModuleError('')
    setModuleNotice('')

    try {
      await resolveOrderReturnRequest(devolucion.id_devolucion, { resolucion }, token)
      setModuleNotice(`Devolucion #${devolucion.id_devolucion} resuelta: ${resolucion}`)
      notifySuccess(`Devolucion #${devolucion.id_devolucion} resuelta`)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo resolver la devolucion'
      setModuleError(message)
      notifyError(message)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de devoluciones">
      <ReloadButton onClick={loadInitialData} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Devoluciones</h3>
          <p>Recepcion fisica de producto devuelto y resolucion (reingreso a inventario o perdida).</p>
        </div>
      </div>

      <div className="maturation-tab-strip" role="tablist" aria-label="Vista de devoluciones">
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

      {moduleError ? <p className="feedback error">{moduleError}</p> : null}
      {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

      {viewMode === 'gestion' ? (
        <>
          <div className="providers-header-row" style={{ marginTop: '12px' }}>
            <div>
              <h4 style={{ marginTop: 0 }}>Lineas pendientes de recepcion</h4>
              <p>Productos no entregados en una ruta, esperando volver fisicamente al almacen.</p>
            </div>
          </div>

          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Piloto</th>
                  <th>Producto</th>
                  <th>Cantidad pedida</th>
                  <th>Cantidad no entregada</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingLines.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan="8" className="empty-table-cell">No hay lineas pendientes de recepcion.</td>
                  </tr>
                ) : null}
                {pendingLines.map((line) => {
                  const cantidadNoEntregada =
                    line.cantidad_entregada === null || line.cantidad_entregada === undefined
                      ? line.cantidad
                      : Number(line.cantidad) - Number(line.cantidad_entregada)

                  return (
                    <tr key={line.id_detalle}>
                      <td>#{line.id_pedido}</td>
                      <td>{line.nombre_comercial || `Cliente #${line.id_cliente}`}</td>
                      <td>{line.piloto_nombre || (line.id_piloto ? `Piloto #${line.id_piloto}` : '-')}</td>
                      <td>{line.producto_nombre || `Producto #${line.id_producto}`}</td>
                      <td>{formatNumber(line.cantidad)}</td>
                      <td>{formatNumber(cantidadNoEntregada)}</td>
                      <td>{line.estado_entrega}</td>
                      <td className="table-actions">
                        {canReceive ? (
                          <button type="button" className="secondary-button" onClick={() => openReceptionModal(line)}>
                            Recibir
                          </button>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="maturation-section-divider" aria-hidden="true" />

          <div className="providers-header-row">
            <div>
              <h4 style={{ marginTop: 0 }}>Devoluciones pendientes de revision</h4>
              <p>Ya se recibieron fisicamente; decide si vuelven a inventario o se dan de baja como perdida.</p>
            </div>
          </div>

          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Devolucion</th>
                  <th>Producto</th>
                  <th>Piloto</th>
                  <th>Cantidad</th>
                  <th>Motivo</th>
                  <th>Recibido por</th>
                  <th>Fecha recepcion</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingReview.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan="8" className="empty-table-cell">No hay devoluciones pendientes de revision.</td>
                  </tr>
                ) : null}
                {pendingReview.map((item) => (
                  <tr key={item.id_devolucion}>
                    <td>#{item.id_devolucion}</td>
                    <td>{item.producto_nombre || `Producto #${item.id_producto}`}</td>
                    <td>{item.piloto_nombre || (item.id_piloto ? `Piloto #${item.id_piloto}` : '-')}</td>
                    <td>{formatNumber(item.cantidad_devuelta)}</td>
                    <td>{item.motivo || '-'}</td>
                    <td>{item.usuario_recepcion_nombre || '-'}</td>
                    <td>{formatDateTime(item.fecha_recepcion)}</td>
                    <td className="table-actions">
                      {canResolve ? (
                        <>
                          <button type="button" className="secondary-button" onClick={() => handleResolve(item, RESOLUTION_REINGRESADO)}>
                            Reingresar a inventario
                          </button>
                          <button type="button" className="danger-button" onClick={() => handleResolve(item, RESOLUTION_PERDIDA)}>
                            Marcar perdida
                          </button>
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="maturation-filter-panel">
            <div className="maturation-filter-grid">
              <label className="maturation-filter-field">
                <span className="maturation-filter-label">Buscar</span>
                <input
                  type="text"
                  value={consultaSearchTerm}
                  onChange={(event) => setConsultaSearchTerm(event.target.value)}
                  placeholder="#devolucion, producto, cliente, piloto o resolucion"
                  className="maturation-filter-input"
                />
              </label>
            </div>
          </div>

          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Devolucion</th>
                  <th>Pedido</th>
                  <th>Producto</th>
                  <th>Piloto</th>
                  <th>Cantidad</th>
                  <th>Resolucion</th>
                  <th>Recibido por</th>
                  <th>Resuelto por</th>
                  <th>Fecha resolucion</th>
                </tr>
              </thead>
              <tbody>
                {consultaReturns.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan="9" className="empty-table-cell">No hay devoluciones registradas.</td>
                  </tr>
                ) : null}
                {consultaReturns.map((item) => (
                  <tr key={item.id_devolucion}>
                    <td>#{item.id_devolucion}</td>
                    <td>#{item.id_pedido}</td>
                    <td>{item.producto_nombre || `Producto #${item.id_producto}`}</td>
                    <td>{item.piloto_nombre || (item.id_piloto ? `Piloto #${item.id_piloto}` : '-')}</td>
                    <td>{formatNumber(item.cantidad_devuelta)}</td>
                    <td>{item.resolucion}</td>
                    <td>{item.usuario_recepcion_nombre || '-'}</td>
                    <td>{item.usuario_resolucion_nombre || '-'}</td>
                    <td>{formatDateTime(item.fecha_resolucion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {receptionModalOpen && receptionLine ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>
                  Recibir devolucion · Pedido #{receptionLine.id_pedido}
                </h4>
                <p style={{ margin: 0 }}>{receptionLine.producto_nombre || `Producto #${receptionLine.id_producto}`}</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeReceptionModal}>
                Cerrar
              </button>
            </div>

            {moduleError ? <p className="feedback error">{moduleError}</p> : null}

            <form className="provider-form" onSubmit={handleReceptionSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Cantidad devuelta *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={receptionForm.cantidad_devuelta}
                    onChange={(event) =>
                      setReceptionForm((previous) => ({ ...previous, cantidad_devuelta: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Motivo
                  <input
                    type="text"
                    value={receptionForm.motivo}
                    onChange={(event) => setReceptionForm((previous) => ({ ...previous, motivo: event.target.value }))}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Registrar recepcion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ReturnsModule
