import { useEffect, useState } from 'react'
import { listSublotsRequest } from '../../services/maturation.service'
import { listProductsRequest } from '../../services/product.service'
import { createGreenNetRequest, listGreenNetsRequest } from '../../services/green_net.service'
import { downloadTraceabilityLabelPdf } from '../../utils/traceabilityLabel'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const GREEN_RIPENESS_STATE = 'Verde'
const SUBLOT_ACTIVE_STATE = 'Activo'
const FINISHED_PRODUCT_TYPE = 'Producto Terminado'

const EMPTY_GREEN_NET_FORM = {
  id_sublote: '',
  id_producto: '',
  fecha_vencimiento: '',
  costo_unitario: '',
}

const EMPTY_CAJA_ROW = { cantidad_redes: '', peso_kg: '' }

const EMPTY_QUICK_FILL = { numero_cajas: '', redes_por_caja: '', peso_por_caja: '' }

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
  const [cajas, setCajas] = useState([{ ...EMPTY_CAJA_ROW }])
  const [quickFill, setQuickFill] = useState(EMPTY_QUICK_FILL)
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

  const handleCajaFieldChange = (index, field, value) => {
    setCajas((previous) => {
      const next = [...previous]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddCajaRow = () => {
    setCajas((previous) => [...previous, { ...EMPTY_CAJA_ROW }])
  }

  const handleRemoveCajaRow = (index) => {
    setCajas((previous) => (previous.length === 1 ? previous : previous.filter((_, i) => i !== index)))
  }

  const handleQuickFillChange = (event) => {
    const { name, value } = event.target
    setQuickFill((previous) => ({ ...previous, [name]: value }))
  }

  const handleGenerateCajas = () => {
    const numeroCajas = Number.parseInt(quickFill.numero_cajas, 10)
    const redesPorCaja = quickFill.redes_por_caja
    const pesoPorCaja = quickFill.peso_por_caja

    if (!Number.isFinite(numeroCajas) || numeroCajas <= 0) {
      setModuleError('Indica cuantas cajas quieres generar')
      return
    }

    const generated = Array.from({ length: numeroCajas }, () => ({
      cantidad_redes: redesPorCaja,
      peso_kg: pesoPorCaja,
    }))

    setCajas((previous) => {
      const existingIsBlank = previous.length === 1 && !previous[0].cantidad_redes && !previous[0].peso_kg
      return existingIsBlank ? generated : [...previous, ...generated]
    })
    setQuickFill(EMPTY_QUICK_FILL)
    setModuleError('')
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({ search: '', mes: '' })
  }

  const validCajas = cajas.filter((caja) => caja.cantidad_redes !== '' && caja.peso_kg !== '')
  const cajasTotalRedes = validCajas.reduce((sum, caja) => sum + (Number(caja.cantidad_redes) || 0), 0)
  const cajasTotalPeso = validCajas.reduce((sum, caja) => sum + (Number(caja.peso_kg) || 0), 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')

    if (validCajas.length === 0) {
      setModuleError('Añade al menos una caja con su cantidad de redes y peso')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        id_sublote: Number(form.id_sublote),
        id_producto: Number(form.id_producto),
        fecha_vencimiento: form.fecha_vencimiento,
        costo_unitario: emptyToUndefined(form.costo_unitario),
        cajas: validCajas.map((caja) => ({
          cantidad_redes: Number(caja.cantidad_redes),
          peso_kg: Number(caja.peso_kg),
        })),
      }

      await createGreenNetRequest(payload, token)
      const successMessage = `${validCajas.length} caja${validCajas.length === 1 ? '' : 's'} registrada${validCajas.length === 1 ? '' : 's'} (${cajasTotalRedes} redes en total)`
      setModuleNotice(successMessage)
      notifySuccess(successMessage)
      setForm(EMPTY_GREEN_NET_FORM)
      setCajas([{ ...EMPTY_CAJA_ROW }])
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo registrar la red'
      setModuleError(message)
      notifyError(message)
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
  const totalRedesRegistradas = filteredNets.reduce((sum, net) => sum + (Number(net.cantidad_redes) || 0), 0)

  const handleDownloadNetLabel = (net) => {
    downloadTraceabilityLabelPdf({
      code: net.codigo_lote || `Caja #${net.id_red}`,
      title: 'Etiqueta de trazabilidad - Caja de redes',
      lines: [
        `Producto: ${net.producto_nombre || `#${net.id_producto}`}`,
        `Caja: #${net.id_red}`,
        `Redes en la caja: ${net.cantidad_redes ?? '-'}`,
        `Peso de la caja: ${formatNumber(net.peso_kg)} kg`,
        `Sub-lote: #${net.id_sublote} (${net.codigo_sublote || '-'})`,
        `Lote MP: ${net.id_lote_mp ? `#${net.id_lote_mp}` : 'N/A'}`,
        `Fecha empaque: ${net.fecha_empaque ? new Date(net.fecha_empaque).toLocaleString('es-GT') : '-'}`,
      ],
      fileName: `etiqueta_caja_${net.id_red}.pdf`,
    })
  }

  return (
    <section className="panel-card" aria-label="Modulo de redes de platano verde">
      <ReloadButton onClick={loadInitialData} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Redes de Platano Verde</h3>
          <p>Empaca sub-lotes verdes disponibles como producto terminado en red.</p>
        </div>
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

        <div className="maturation-section-divider" aria-hidden="true" />

        <h4>Cajas a registrar</h4>
        <p className="widget-muted" style={{ margin: '0 0 10px' }}>
          Cada caja es un registro (no cada red suelta): indica cuantas redes contiene y el peso total de la caja.
          Si vas a registrar varias cajas iguales, usa el generador rapido.
        </p>

        <div className="maturation-filter-panel">
          <div className="maturation-filter-grid">
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Cantidad de cajas</span>
              <input
                name="numero_cajas"
                type="number"
                min="1"
                step="1"
                value={quickFill.numero_cajas}
                onChange={handleQuickFillChange}
                placeholder="ej. 10"
                className="maturation-filter-input"
              />
            </label>
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Redes por caja</span>
              <input
                name="redes_por_caja"
                type="number"
                min="1"
                step="1"
                value={quickFill.redes_por_caja}
                onChange={handleQuickFillChange}
                placeholder="ej. 50"
                className="maturation-filter-input"
              />
            </label>
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Peso por caja (kg)</span>
              <input
                name="peso_por_caja"
                type="number"
                min="0"
                step="0.01"
                value={quickFill.peso_por_caja}
                onChange={handleQuickFillChange}
                placeholder="ej. 25.00"
                className="maturation-filter-input"
              />
            </label>
          </div>
          <div className="maturation-filter-actions">
            <button type="button" className="secondary-button" onClick={handleGenerateCajas}>
              Generar cajas
            </button>
          </div>
        </div>

        <div className="providers-table-wrap table-limited">
          <table className="providers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Redes en la caja</th>
                <th>Peso de la caja (kg)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cajas.map((caja, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={caja.cantidad_redes}
                      onChange={(event) => handleCajaFieldChange(index, 'cantidad_redes', event.target.value)}
                      placeholder="0"
                      className="maturation-filter-input"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={caja.peso_kg}
                      onChange={(event) => handleCajaFieldChange(index, 'peso_kg', event.target.value)}
                      placeholder="0.00"
                      className="maturation-filter-input"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleRemoveCajaRow(index)}
                      disabled={cajas.length === 1}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="provider-form-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="secondary-button" onClick={handleAddCajaRow}>
            + Agregar caja
          </button>
          <p style={{ margin: 0 }}>
            {validCajas.length} caja{validCajas.length === 1 ? '' : 's'} · {cajasTotalRedes} redes · {formatNumber(cajasTotalPeso)} kg
            {selectedSublot && cajasTotalPeso > Number(selectedSublot.peso_kg) ? (
              <span style={{ color: '#8f1b1b', fontWeight: 700 }}> - supera el disponible ({formatNumber(selectedSublot.peso_kg)} kg)</span>
            ) : null}
          </p>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : `Registrar ${validCajas.length || ''} caja${validCajas.length === 1 ? '' : 's'}`}
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
        Cajas mostradas: {filteredNets.length} · Redes totales: {totalRedesRegistradas} · Peso total: {formatNumber(totalPesoRegistrado)} kg
      </p>

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Caja</th>
              <th>Sub-lote</th>
              <th>Lote origen</th>
              <th>Producto</th>
              <th>Redes</th>
              <th>Peso (kg)</th>
              <th>Usuario</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredNets.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="9" className="empty-table-cell">
                  No hay cajas registradas.
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
                <td>{net.cantidad_redes ?? '-'}</td>
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
