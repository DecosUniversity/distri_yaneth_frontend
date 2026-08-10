import { useEffect, useState } from 'react'
import { listSublotsRequest } from '../../services/maturation.service'
import { listProductsRequest } from '../../services/product.service'
import { createGreenNetRequest, listGreenNetsRequest } from '../../services/green_net.service'
import { buildTraceabilityCode, downloadTraceabilityLabelPdf } from '../../utils/traceabilityLabel'

const GREEN_RIPENESS_STATE = 'Verde'
const SUBLOT_ACTIVE_STATE = 'Activo'
const FINISHED_PRODUCT_TYPE = 'Producto Terminado'

const EMPTY_GREEN_NET_FORM = {
  id_sublote: '',
  id_producto: '',
  peso_kg: '',
  fecha_vencimiento: '',
  costo_unitario: '',
}

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

function GreenNetsModule({ token, isActive }) {
  const [sublots, setSublots] = useState([])
  const [products, setProducts] = useState([])
  const [nets, setNets] = useState([])
  const [form, setForm] = useState(EMPTY_GREEN_NET_FORM)
  const [filters, setFilters] = useState({ search: '', mes: '' })
  const [viewMode, setViewMode] = useState('gestion')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

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
      const [sublotsData, productsData, netsData] = await Promise.all([
        listSublotsRequest(token),
        listProductsRequest(token),
        listGreenNetsRequest(token),
      ])

      setSublots(Array.isArray(sublotsData) ? sublotsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setNets(Array.isArray(netsData) ? netsData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de redes verdes')
    } finally {
      setIsLoading(false)
    }
  }

  const availableSublots = sublots.filter(
    (sublot) =>
      sublot.estado_maduracion === GREEN_RIPENESS_STATE &&
      sublot.estado_registro === SUBLOT_ACTIVE_STATE &&
      Number(sublot.peso_kg) > 0
  )

  const finishedProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === FINISHED_PRODUCT_TYPE
  )

  const selectedSublot = sublots.find((sublot) => String(sublot.id_sublote) === String(form.id_sublote))

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({ search: '', mes: '' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmitting(true)

    try {
      const payload = {
        id_sublote: Number(form.id_sublote),
        id_producto: Number(form.id_producto),
        peso_kg: Number(form.peso_kg),
        fecha_vencimiento: form.fecha_vencimiento,
        costo_unitario: emptyToUndefined(form.costo_unitario),
      }

      await createGreenNetRequest(payload, token)
      setModuleNotice('Red de platano verde registrada correctamente')
      setForm(EMPTY_GREEN_NET_FORM)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo registrar la red')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredNets = nets.filter((net) => {
    const searchTerm = filters.search.trim().toLowerCase()
    const mesTerm = filters.mes.trim()

    const matchesSearch =
      !searchTerm ||
      String(net.id_red || '').toLowerCase().includes(searchTerm) ||
      String(net.id_sublote || '').toLowerCase().includes(searchTerm) ||
      `${net.producto_nombre || ''}`.toLowerCase().includes(searchTerm)

    const matchesMes = !mesTerm || formatMonthInputValue(net.fecha_empaque) === mesTerm

    return matchesSearch && matchesMes
  })

  const totalPesoRegistrado = filteredNets.reduce((sum, net) => sum + (Number(net.peso_kg) || 0), 0)

  const handleDownloadNetLabel = (net) => {
    const code = buildTraceabilityCode({
      id_proveedor: net.id_proveedor_origen,
      id_entrada: net.id_entrada_origen,
      id_lote: net.id_lote_mp,
      id_producto: net.id_producto,
    })

    downloadTraceabilityLabelPdf({
      code,
      title: 'Etiqueta de trazabilidad - Red',
      lines: [
        `Producto: ${net.producto_nombre || `#${net.id_producto}`}`,
        `Red: #${net.id_red}`,
        `Sub-lote: #${net.id_sublote} (${net.codigo_sublote || '-'})`,
        `Lote MP: ${net.id_lote_mp ? `#${net.id_lote_mp}` : 'N/A'}`,
        `Fecha empaque: ${net.fecha_empaque ? new Date(net.fecha_empaque).toLocaleString('es-GT') : '-'}`,
      ],
      fileName: `etiqueta_red_${net.id_red}.pdf`,
    })
  }

  return (
    <section className="panel-card" aria-label="Modulo de redes de platano verde">
      <div className="providers-header-row">
        <div>
          <h3>Redes de Platano Verde</h3>
          <p>Empaca sub-lotes verdes disponibles como producto terminado en red.</p>
        </div>
        <button type="button" className="secondary-button" onClick={loadInitialData} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Recargar'}
        </button>
      </div>

      <div className="maturation-tab-strip" role="tablist" aria-label="Vista de redes">
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
      <form className="provider-form" onSubmit={handleSubmit}>
        <h4 style={{ marginTop: 0 }}>Registrar red</h4>
        <div className="provider-form-grid">
          <label>
            Sub-lote verde disponible *
            <select name="id_sublote" value={form.id_sublote} onChange={handleFieldChange} required>
              <option value="">Selecciona sub-lote</option>
              {availableSublots.map((sublot) => (
                <option key={sublot.id_sublote} value={sublot.id_sublote}>
                  {`#${sublot.id_sublote} (${sublot.codigo_sublote}) - ${sublot.producto_nombre || `Producto ${sublot.id_producto}`} (disponible ${formatNumber(sublot.peso_kg)} kg)`}
                </option>
              ))}
            </select>
            {selectedSublot ? <small>Disponible: {formatNumber(selectedSublot.peso_kg)} kg</small> : null}
          </label>

          <label>
            Producto (red terminada) *
            <select name="id_producto" value={form.id_producto} onChange={handleFieldChange} required>
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
              value={form.peso_kg}
              onChange={handleFieldChange}
              placeholder="0.00"
              required
            />
          </label>

          <label>
            Fecha vencimiento *
            <input
              name="fecha_vencimiento"
              type="date"
              value={form.fecha_vencimiento}
              onChange={handleFieldChange}
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
              value={form.costo_unitario}
              onChange={handleFieldChange}
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Registrar red'}
          </button>
        </div>
      </form>
      ) : (
      <>
      <div className="maturation-filter-panel">
        <div className="maturation-filter-grid">
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Red / Sub-lote / Producto</span>
            <input
              name="search"
              type="text"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="#red, #sublote o producto"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Mes</span>
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

      <p>
        Redes mostradas: {filteredNets.length} · Peso total: {formatNumber(totalPesoRegistrado)} kg
      </p>

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Red</th>
              <th>Sub-lote</th>
              <th>Lote origen</th>
              <th>Producto</th>
              <th>Peso (kg)</th>
              <th>Usuario</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredNets.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  No hay redes registradas.
                </td>
              </tr>
            ) : null}

            {filteredNets.map((net) => (
              <tr key={net.id_red}>
                <td>#{net.id_red}</td>
                <td>
                  #{net.id_sublote} {net.codigo_sublote ? `(${net.codigo_sublote})` : ''}
                </td>
                <td>{net.id_lote_mp ? `#${net.id_lote_mp}` : '-'}</td>
                <td>{net.producto_nombre || `Producto #${net.id_producto}`}</td>
                <td>{formatNumber(net.peso_kg)}</td>
                <td>{net.usuario_nombre || '-'}</td>
                <td>{net.fecha_empaque ? new Date(net.fecha_empaque).toLocaleString('es-GT') : '-'}</td>
                <td className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => handleDownloadNetLabel(net)}>
                    Etiqueta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </section>
  )
}

export default GreenNetsModule
