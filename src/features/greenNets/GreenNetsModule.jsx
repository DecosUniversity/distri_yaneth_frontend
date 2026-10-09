import { useEffect, useState } from 'react'
import { listGreenNetsRequest } from '../../services/green_net.service'
import { downloadTraceabilityLabelPdf } from '../../utils/traceabilityLabel'
import ReloadButton from '../../components/common/ReloadButton'

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

// El empaque de redes se estandarizo dentro de Produccion ("+ Empacar red"), como un proceso
// de produccion mas (con sus etapas, mermas e insumos). Este modulo queda solo para consultar
// las cajas registradas antes de ese cambio; no se pueden crear cajas nuevas desde aqui.
function GreenNetsModule({ token, isActive }) {
  const [nets, setNets] = useState([])
  const [filters, setFilters] = useState({ search: '', mes: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [moduleError, setModuleError] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadNets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadNets = async () => {
    setModuleError('')
    setIsLoading(true)

    try {
      const netsData = await listGreenNetsRequest(token)
      setNets(Array.isArray(netsData) ? netsData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar el historico de redes verdes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({ search: '', mes: '' })
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
    <section className="panel-card" aria-label="Historico de redes de platano verde">
      <ReloadButton onClick={loadNets} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Redes de Platano Verde (historico)</h3>
          <p>
            Registro de cajas empacadas antes de estandarizar este flujo dentro de Produccion. Para empacar una red
            nueva, ve a Produccion y usa "+ Empacar red".
          </p>
        </div>
      </div>

      {moduleError ? <p className="feedback error">{moduleError}</p> : null}

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
    </section>
  )
}

export default GreenNetsModule
