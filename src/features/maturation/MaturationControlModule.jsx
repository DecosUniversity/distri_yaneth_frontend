import { useEffect, useState } from 'react'
import { listProductsRequest } from '../../services/product.service'
import {
  acceptMaturationLotRequest,
  closeSublotRequest,
  createGreenNetRequest,
  createMaturationControlRequest,
  deleteMaturationLotRequest,
  listGreenNetsBySublotRequest,
  listMaturationControlsRequest,
  listMaturationLotsRequest,
  listSublotsRequest,
  splitSublotRequest,
} from '../../services/maturation.service'

const RIPENESS_STATES = ['Verde', 'Sarazo', 'Maduro', 'Sobre maduro']
const GREEN_RIPENESS_STATE = 'Verde'
const PENDING_REGISTRATION_STATE = 'Pendiente'
const SUBLOT_ACTIVE_STATE = 'Activo'
const SUBLOT_READY_STATE = 'Listo para produccion'
const SUBLOT_SENT_STATE = 'Enviado a produccion'
const SUBLOT_GREEN_NET_STATE = 'Derivado a red'
const FINISHED_PRODUCT_TYPE = 'Producto Terminado'
const SUBLOT_TABS = [
  { key: SUBLOT_ACTIVE_STATE, label: 'Activos' },
  { key: SUBLOT_READY_STATE, label: 'Listos para produccion' },
  { key: SUBLOT_SENT_STATE, label: 'Enviados a produccion' },
  { key: SUBLOT_GREEN_NET_STATE, label: 'Derivados a red' },
]

const EMPTY_ACCEPT_FORM = { estado_maduracion: 'Verde' }
const EMPTY_CONTROL_FORM = {
  grados_brix: '',
  peso_medido_kg: '',
  porcentaje_materia_seca: '',
  temperatura_cuarto: '',
  observaciones: '',
}
const EMPTY_SPLIT_FORM = { peso_kg: '', observaciones: '' }
const EMPTY_CLOSE_FORM = { peso_medido_kg: '' }
const EMPTY_GREEN_NET_FORM = { id_producto: '', peso_kg: '', fecha_vencimiento: '', costo_unitario: '' }

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

const formatMonthInputValue = (value) => {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 7)
}

const getTodayDateInputValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const emptyToUndefined = (value) => (value === '' || value === null || value === undefined ? undefined : value)

function MaturationControlModule({ token, isActive }) {
  const [lots, setLots] = useState([])
  const [sublots, setSublots] = useState([])
  const [controls, setControls] = useState([])
  const [products, setProducts] = useState([])
  const [selectedTab, setSelectedTab] = useState(SUBLOT_ACTIVE_STATE)
  const [filters, setFilters] = useState({ sublote: '', producto: '', mes: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

  const [acceptModalOpen, setAcceptModalOpen] = useState(false)
  const [lotToAccept, setLotToAccept] = useState(null)
  const [acceptForm, setAcceptForm] = useState(EMPTY_ACCEPT_FORM)
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false)

  const [detailSublot, setDetailSublot] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailGreenNets, setDetailGreenNets] = useState([])
  const [detailError, setDetailError] = useState('')
  const [detailNotice, setDetailNotice] = useState('')
  const [isSubmittingDetail, setIsSubmittingDetail] = useState(false)

  const [controlForm, setControlForm] = useState(EMPTY_CONTROL_FORM)
  const [splitForm, setSplitForm] = useState(EMPTY_SPLIT_FORM)
  const [closeForm, setCloseForm] = useState(EMPTY_CLOSE_FORM)
  const [greenNetForm, setGreenNetForm] = useState(EMPTY_GREEN_NET_FORM)

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
      const [lotsData, sublotsData, controlsData, productsData] = await Promise.all([
        listMaturationLotsRequest(token),
        listSublotsRequest(token),
        listMaturationControlsRequest(token),
        listProductsRequest(token),
      ])

      setLots(Array.isArray(lotsData) ? lotsData : [])
      setSublots(Array.isArray(sublotsData) ? sublotsData : [])
      setControls(Array.isArray(controlsData) ? controlsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de maduracion')
    } finally {
      setIsLoading(false)
    }
  }

  const pendingLots = lots.filter((lot) => lot.estado_registro === PENDING_REGISTRATION_STATE)
  const acceptedLots = lots.filter((lot) => lot.estado_registro !== PENDING_REGISTRATION_STATE)
  const finishedProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === FINISHED_PRODUCT_TYPE
  )

  const openAcceptModal = (lot) => {
    setLotToAccept(lot)
    setAcceptForm(EMPTY_ACCEPT_FORM)
    setModuleError('')
    setModuleNotice('')
    setAcceptModalOpen(true)
  }

  const closeAcceptModal = () => {
    if (isSubmittingAccept) {
      return
    }

    setAcceptModalOpen(false)
    setLotToAccept(null)
  }

  const handleAcceptFieldChange = (event) => {
    const { name, value } = event.target
    setAcceptForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleAcceptSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingAccept(true)

    try {
      await acceptMaturationLotRequest(lotToAccept.id_lote_mp, { estado_maduracion: acceptForm.estado_maduracion }, token)
      setModuleNotice(`Lote #${lotToAccept.id_lote_mp} aceptado. Se creo el sub-lote A en estado ${acceptForm.estado_maduracion}.`)
      setAcceptModalOpen(false)
      setLotToAccept(null)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo aceptar el lote')
    } finally {
      setIsSubmittingAccept(false)
    }
  }

  const handleDeleteLot = async (lotId) => {
    const confirmDelete = window.confirm('Esta accion eliminara el lote pendiente. Deseas continuar?')

    if (!confirmDelete) {
      return
    }

    setModuleError('')
    setModuleNotice('')

    try {
      await deleteMaturationLotRequest(lotId, token)
      setModuleNotice('Lote eliminado correctamente')
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo eliminar lote')
    }
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({ sublote: '', producto: '', mes: '' })
  }

  const sublotsInSelectedTab = sublots.filter((sublot) => sublot.estado_registro === selectedTab)

  const filteredSublots = sublotsInSelectedTab.filter((sublot) => {
    const subloteTerm = filters.sublote.trim().toLowerCase()
    const productoTerm = filters.producto.trim().toLowerCase()
    const mesTerm = filters.mes.trim()

    const matchesSublote =
      !subloteTerm ||
      String(sublot.id_sublote || '').toLowerCase().includes(subloteTerm) ||
      String(sublot.id_lote_mp || '').toLowerCase().includes(subloteTerm) ||
      String(sublot.codigo_sublote || '').toLowerCase().includes(subloteTerm)

    const matchesProducto =
      !productoTerm || `${sublot.producto_nombre || ''}`.toLowerCase().includes(productoTerm)

    const matchesMes = !mesTerm || formatMonthInputValue(sublot.fecha_creacion) === mesTerm

    return matchesSublote && matchesProducto && matchesMes
  })

  const tabCounts = SUBLOT_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = sublots.filter((sublot) => sublot.estado_registro === tab.key).length
    return accumulator
  }, {})

  const openDetail = async (sublot) => {
    setDetailSublot(sublot)
    setDetailError('')
    setDetailNotice('')
    setControlForm(EMPTY_CONTROL_FORM)
    setSplitForm(EMPTY_SPLIT_FORM)
    setCloseForm(EMPTY_CLOSE_FORM)
    setGreenNetForm(EMPTY_GREEN_NET_FORM)
    setDetailModalOpen(true)

    try {
      const nets = await listGreenNetsBySublotRequest(sublot.id_sublote, token)
      setDetailGreenNets(Array.isArray(nets) ? nets : [])
    } catch {
      setDetailGreenNets([])
    }
  }

  const closeDetail = () => {
    if (isSubmittingDetail) {
      return
    }

    setDetailModalOpen(false)
    setDetailSublot(null)
  }

  const refreshDetailSublot = async (id) => {
    const updatedList = await listSublotsRequest(token)
    setSublots(Array.isArray(updatedList) ? updatedList : [])
    const updated = (Array.isArray(updatedList) ? updatedList : []).find((row) => row.id_sublote === id)

    if (updated) {
      setDetailSublot(updated)
    }
  }

  const controlsForDetail = controls
    .filter((control) => detailSublot && control.id_sublote === detailSublot.id_sublote)
    .sort((a, b) => new Date(b.fecha_medicion) - new Date(a.fecha_medicion))

  const handleControlFieldChange = (event) => {
    const { name, value } = event.target
    setControlForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleControlSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        id_sublote: detailSublot.id_sublote,
        grados_brix: Number(controlForm.grados_brix),
        peso_medido_kg: emptyToUndefined(controlForm.peso_medido_kg),
        porcentaje_materia_seca: emptyToUndefined(controlForm.porcentaje_materia_seca),
        temperatura_cuarto: emptyToUndefined(controlForm.temperatura_cuarto),
        observaciones: emptyToUndefined(controlForm.observaciones.trim()),
      }

      const result = await createMaturationControlRequest(payload, token)
      setDetailNotice(
        result?.sublote_promovido
          ? 'Control registrado. El sub-lote alcanzo el umbral tecnico y paso a Listo para produccion.'
          : 'Control registrado correctamente'
      )
      setControlForm(EMPTY_CONTROL_FORM)
      const updatedControls = await listMaturationControlsRequest(token)
      setControls(Array.isArray(updatedControls) ? updatedControls : [])
      await refreshDetailSublot(detailSublot.id_sublote)
    } catch (error) {
      setDetailError(error.message || 'No se pudo registrar el control')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleSplitFieldChange = (event) => {
    const { name, value } = event.target
    setSplitForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleSplitSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        peso_kg: Number(splitForm.peso_kg),
        observaciones: emptyToUndefined(splitForm.observaciones.trim()),
      }

      const result = await splitSublotRequest(detailSublot.id_sublote, payload, token)
      setDetailNotice(`Sub-lote fraccionado: se creo ${result?.nuevo?.codigo_sublote || 'un nuevo sub-lote'}`)
      setSplitForm(EMPTY_SPLIT_FORM)
      await refreshDetailSublot(detailSublot.id_sublote)
    } catch (error) {
      setDetailError(error.message || 'No se pudo fraccionar el sub-lote')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleCloseFieldChange = (event) => {
    const { name, value } = event.target
    setCloseForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleCloseSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = { peso_medido_kg: emptyToUndefined(closeForm.peso_medido_kg) }
      await closeSublotRequest(detailSublot.id_sublote, payload, token)
      setDetailNotice('Sub-lote cerrado: paso a Listo para produccion')
      setCloseForm(EMPTY_CLOSE_FORM)
      await refreshDetailSublot(detailSublot.id_sublote)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo cerrar la maduracion del sub-lote')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleGreenNetFieldChange = (event) => {
    const { name, value } = event.target
    setGreenNetForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleGreenNetSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        id_sublote: detailSublot.id_sublote,
        id_producto: Number(greenNetForm.id_producto),
        peso_kg: Number(greenNetForm.peso_kg),
        fecha_vencimiento: greenNetForm.fecha_vencimiento,
        costo_unitario: emptyToUndefined(greenNetForm.costo_unitario),
      }

      await createGreenNetRequest(payload, token)
      setDetailNotice('Red de platano verde registrada correctamente')
      setGreenNetForm(EMPTY_GREEN_NET_FORM)
      const nets = await listGreenNetsBySublotRequest(detailSublot.id_sublote, token)
      setDetailGreenNets(Array.isArray(nets) ? nets : [])
      await refreshDetailSublot(detailSublot.id_sublote)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo registrar la red de platano verde')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const isSublotActive = detailSublot?.estado_registro === SUBLOT_ACTIVE_STATE
  const isSublotGreen = detailSublot?.estado_maduracion === GREEN_RIPENESS_STATE

  return (
    <section className="panel-card" aria-label="Modulo de control de maduracion">
      <div className="providers-header-row">
        <div>
          <h3>Control de Maduracion</h3>
          <p>Acepta entradas pendientes, da seguimiento a sub-lotes y registra mediciones de laboratorio.</p>
        </div>
        <button type="button" className="secondary-button" onClick={loadInitialData} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Recargar'}
        </button>
      </div>

      <div className="providers-header-row" style={{ marginTop: '12px' }}>
        <div>
          <h4 style={{ marginTop: 0 }}>Entradas pendientes de aceptar</h4>
          <p>Pendientes: {pendingLots.length}</p>
        </div>
      </div>

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Entrada origen</th>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Recepcion</th>
              <th>Peso inicial</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pendingLots.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No hay entradas pendientes.
                </td>
              </tr>
            ) : null}

            {pendingLots.map((lot) => (
              <tr key={lot.id_lote_mp}>
                <td>#{lot.id_lote_mp}</td>
                <td>{lot.id_entrada_origen ? `#${lot.id_entrada_origen}` : '-'}</td>
                <td>{lot.producto_nombre || `Producto #${lot.id_producto}`}</td>
                <td>{lot.proveedor_nombre || `Proveedor #${lot.id_proveedor}`}</td>
                <td>{lot.fecha_recepcion || '-'}</td>
                <td>{formatNumber(lot.peso_inicial_kg)}</td>
                <td className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => openAcceptModal(lot)}>
                    Aceptar
                  </button>
                  <button type="button" className="danger-button" onClick={() => handleDeleteLot(lot.id_lote_mp)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="maturation-section-divider" aria-hidden="true" />

      <div className="providers-header-row">
        <div>
          <h4 style={{ marginTop: 0 }}>Resumen de lotes</h4>
          <p>Peso disponible = suma del peso restante de todos los sub-lotes de ese lote (ya descuenta redes verdes y produccion).</p>
        </div>
      </div>

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Recepcion</th>
              <th>Peso recibido</th>
              <th>Peso disponible</th>
              <th>Consumido</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {acceptedLots.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  Aun no hay lotes aceptados.
                </td>
              </tr>
            ) : null}

            {acceptedLots.map((lot) => {
              const received = Number(lot.peso_inicial_kg) || 0
              const available = Number(lot.peso_disponible_kg) || 0
              const consumedPercent = received > 0 ? ((received - available) / received) * 100 : 0

              return (
                <tr key={lot.id_lote_mp}>
                  <td>#{lot.id_lote_mp}</td>
                  <td>{lot.producto_nombre || `Producto #${lot.id_producto}`}</td>
                  <td>{lot.proveedor_nombre || `Proveedor #${lot.id_proveedor}`}</td>
                  <td>{lot.fecha_recepcion || '-'}</td>
                  <td>{formatNumber(lot.peso_inicial_kg)}</td>
                  <td>{formatNumber(lot.peso_disponible_kg)}</td>
                  <td>{formatNumber(consumedPercent)}%</td>
                  <td>{lot.estado_registro || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="maturation-section-divider" aria-hidden="true" />

      <div className="maturation-tab-strip">
        {SUBLOT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              selectedTab === tab.key
                ? 'secondary-button maturation-tab-button is-active'
                : 'secondary-button maturation-tab-button'
            }
            onClick={() => setSelectedTab(tab.key)}
          >
            {tab.label} ({tabCounts[tab.key] || 0})
          </button>
        ))}
      </div>

      <div className="maturation-filter-panel">
        <div className="maturation-filter-grid">
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Sub-lote / Lote</span>
            <input
              name="sublote"
              type="text"
              value={filters.sublote}
              onChange={handleFilterChange}
              placeholder="#sublote, codigo o #lote"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Producto</span>
            <input
              name="producto"
              type="text"
              value={filters.producto}
              onChange={handleFilterChange}
              placeholder="Producto"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Mes creacion</span>
            <input
              name="mes"
              type="month"
              value={filters.mes}
              onChange={handleFilterChange}
              className="maturation-filter-input"
            />
          </label>
        </div>

        <div className="maturation-filter-actions">
          <button type="button" className="secondary-button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {moduleError ? <p className="feedback error">{moduleError}</p> : null}
      {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

      <div className="providers-table-wrap table-limited" style={{ marginTop: '8px' }}>
        <table className="providers-table">
          <thead>
            <tr>
              <th>Sub-lote</th>
              <th>Lote origen</th>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Peso disponible</th>
              <th>Peso neto maduracion</th>
              <th>Estado maduracion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSublots.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  No hay sub-lotes en esta pestaña.
                </td>
              </tr>
            ) : null}

            {filteredSublots.map((sublot) => (
              <tr key={sublot.id_sublote}>
                <td>
                  #{sublot.id_sublote} ({sublot.codigo_sublote})
                </td>
                <td>#{sublot.id_lote_mp}</td>
                <td>{sublot.producto_nombre || `Producto #${sublot.id_producto}`}</td>
                <td>{sublot.proveedor_nombre || `Proveedor #${sublot.id_proveedor}`}</td>
                <td>{formatNumber(sublot.peso_kg)}</td>
                <td>{formatNumber(sublot.peso_neto_maduracion_kg)}</td>
                <td>{sublot.estado_maduracion || '-'}</td>
                <td className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => openDetail(sublot)}>
                    Gestionar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {acceptModalOpen && lotToAccept ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Aceptar lote #{lotToAccept.id_lote_mp}</h4>
                <p style={{ margin: 0 }}>
                  Indica el estado de maduracion observado. Se creara el sub-lote A con el 100% del peso.
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeAcceptModal}>
                Cerrar
              </button>
            </div>

            <form className="provider-form" onSubmit={handleAcceptSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Estado de maduracion *
                  <select name="estado_maduracion" value={acceptForm.estado_maduracion} onChange={handleAcceptFieldChange} required>
                    {RIPENESS_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {acceptForm.estado_maduracion === 'Maduro' ? (
                    <small>El sub-lote pasara directo a Listo para produccion, sin control de laboratorio.</small>
                  ) : null}
                </label>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmittingAccept}>
                  {isSubmittingAccept ? 'Guardando...' : 'Aceptar entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailModalOpen && detailSublot ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>
                  Sub-lote #{detailSublot.id_sublote} ({detailSublot.codigo_sublote})
                </h4>
                <p style={{ margin: 0 }}>
                  {detailSublot.producto_nombre || 'Producto'} · {detailSublot.estado_maduracion} ·{' '}
                  {detailSublot.estado_registro} · Disponible: {formatNumber(detailSublot.peso_kg)} kg
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeDetail}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}
            {detailNotice ? <p className="feedback success">{detailNotice}</p> : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Controles de laboratorio</h4>
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Brix</th>
                    <th>Peso medido</th>
                    <th>Materia seca %</th>
                    <th>Temperatura</th>
                  </tr>
                </thead>
                <tbody>
                  {controlsForDetail.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-table-cell">
                        Sin controles registrados.
                      </td>
                    </tr>
                  ) : null}
                  {controlsForDetail.map((control) => (
                    <tr key={control.id_control}>
                      <td>{control.fecha_medicion ? new Date(control.fecha_medicion).toLocaleString('es-GT') : '-'}</td>
                      <td>{control.grados_brix ?? '-'}</td>
                      <td>{formatNumber(control.peso_medido_kg)}</td>
                      <td>{control.porcentaje_materia_seca ?? '-'}</td>
                      <td>{control.temperatura_cuarto ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isSublotActive ? (
              <form className="provider-form" onSubmit={handleControlSubmit}>
                <div className="provider-form-grid">
                  <label>
                    Grados Brix *
                    <input
                      name="grados_brix"
                      type="number"
                      min="0"
                      step="0.01"
                      value={controlForm.grados_brix}
                      onChange={handleControlFieldChange}
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label>
                    Peso medido (kg)
                    <input
                      name="peso_medido_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={controlForm.peso_medido_kg}
                      onChange={handleControlFieldChange}
                      placeholder="0.00"
                    />
                    <small>Necesario para cerrar la maduracion (perdida por deshidratacion).</small>
                  </label>

                  <label>
                    Materia seca (%)
                    <input
                      name="porcentaje_materia_seca"
                      type="number"
                      min="0"
                      step="0.01"
                      value={controlForm.porcentaje_materia_seca}
                      onChange={handleControlFieldChange}
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Temperatura cuarto
                    <input
                      name="temperatura_cuarto"
                      type="number"
                      step="0.01"
                      value={controlForm.temperatura_cuarto}
                      onChange={handleControlFieldChange}
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Observaciones
                    <input
                      name="observaciones"
                      type="text"
                      value={controlForm.observaciones}
                      onChange={handleControlFieldChange}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="provider-form-actions">
                  <button type="submit" disabled={isSubmittingDetail}>
                    {isSubmittingDetail ? 'Guardando...' : 'Registrar control'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            {isSublotActive ? (
              <>
                <h4>Fraccionar sub-lote</h4>
                <form className="provider-form" onSubmit={handleSplitSubmit}>
                  <div className="provider-form-grid">
                    <label>
                      Peso a fraccionar (kg) *
                      <input
                        name="peso_kg"
                        type="number"
                        min="0"
                        step="0.01"
                        value={splitForm.peso_kg}
                        onChange={handleSplitFieldChange}
                        placeholder="0.00"
                        required
                      />
                    </label>

                    <label>
                      Observaciones
                      <input
                        name="observaciones"
                        type="text"
                        value={splitForm.observaciones}
                        onChange={handleSplitFieldChange}
                        placeholder="Ej. capacidad de operacion del dia"
                      />
                    </label>
                  </div>

                  <div className="provider-form-actions">
                    <button type="submit" disabled={isSubmittingDetail}>
                      {isSubmittingDetail ? 'Guardando...' : 'Fraccionar'}
                    </button>
                  </div>
                </form>

                <div className="maturation-section-divider" aria-hidden="true" />

                <h4>Cerrar maduracion manualmente</h4>
                <form className="provider-form" onSubmit={handleCloseSubmit}>
                  <div className="provider-form-grid">
                    <label>
                      Peso medido (kg)
                      <input
                        name="peso_medido_kg"
                        type="number"
                        min="0"
                        step="0.01"
                        value={closeForm.peso_medido_kg}
                        onChange={handleCloseFieldChange}
                        placeholder="Usa el ultimo control si se deja vacio"
                      />
                    </label>
                  </div>

                  <div className="provider-form-actions">
                    <button type="submit" disabled={isSubmittingDetail}>
                      {isSubmittingDetail ? 'Guardando...' : 'Cerrar y marcar Listo para produccion'}
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {isSublotActive && isSublotGreen ? (
              <>
                <div className="maturation-section-divider" aria-hidden="true" />

                <h4>Platano verde en red</h4>
                <div className="providers-table-wrap table-limited">
                  <table className="providers-table">
                    <thead>
                      <tr>
                        <th>Peso (kg)</th>
                        <th>Usuario</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailGreenNets.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="empty-table-cell">
                            Sin redes registradas.
                          </td>
                        </tr>
                      ) : null}
                      {detailGreenNets.map((net) => (
                        <tr key={net.id_red}>
                          <td>{formatNumber(net.peso_kg)}</td>
                          <td>{net.usuario_nombre || '-'}</td>
                          <td>{net.fecha_empaque ? new Date(net.fecha_empaque).toLocaleString('es-GT') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form className="provider-form" onSubmit={handleGreenNetSubmit}>
                  <div className="provider-form-grid">
                    <label>
                      Producto (Platano verde en red) *
                      <select
                        name="id_producto"
                        value={greenNetForm.id_producto}
                        onChange={handleGreenNetFieldChange}
                        required
                      >
                        <option value="">Selecciona producto terminado</option>
                        {finishedProducts.map((product) => (
                          <option key={product.id_producto} value={product.id_producto}>
                            {product.nombre || `Producto #${product.id_producto}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Peso de la red (kg) *
                      <input
                        name="peso_kg"
                        type="number"
                        min="0"
                        step="0.01"
                        value={greenNetForm.peso_kg}
                        onChange={handleGreenNetFieldChange}
                        placeholder="0.00"
                        required
                      />
                    </label>

                    <label>
                      Fecha vencimiento *
                      <input
                        name="fecha_vencimiento"
                        type="date"
                        value={greenNetForm.fecha_vencimiento}
                        onChange={handleGreenNetFieldChange}
                        min={getTodayDateInputValue()}
                        required
                      />
                    </label>

                    <label>
                      Costo unitario
                      <input
                        name="costo_unitario"
                        type="number"
                        min="0"
                        step="0.01"
                        value={greenNetForm.costo_unitario}
                        onChange={handleGreenNetFieldChange}
                        placeholder="0.00"
                      />
                    </label>
                  </div>

                  <div className="provider-form-actions">
                    <button type="submit" disabled={isSubmittingDetail}>
                      {isSubmittingDetail ? 'Guardando...' : 'Registrar red'}
                    </button>
                  </div>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default MaturationControlModule
