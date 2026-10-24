import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLogisticsIndicatorsRequest } from '../../services/route.service'
import { notifyError } from '../../utils/toast'

const PDF_HEAD_COLOR = [31, 111, 59]

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(Number(value))
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value))
}

const formatPercent = (value) => (value === null || value === undefined ? '-' : `${formatNumber(value, 1)} %`)
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-GT') : '-')

const toInputDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const firstDayOfMonth = () => {
  const today = new Date()
  return toInputDate(new Date(today.getFullYear(), today.getMonth(), 1))
}

const formatMonth = (value) => {
  const [year, month] = String(value).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
}

const costLabel = (row) => `${formatCurrency(row.costo_combustible_q)}${row.costo_estimado ? ' *' : ''}`
const punctualityLabel = (row) =>
  row.pedidos_con_fecha_programada > 0
    ? `${formatPercent(row.porcentaje_puntualidad)} (${row.pedidos_a_tiempo}/${row.pedidos_con_fecha_programada})`
    : '-'

const GROUP_HEAD = ['Rutas', 'Km', 'Consumo (gal)', 'Km/gal', 'Costo', 'Costo/km', 'Horas/ruta', 'Puntualidad', 'Sin devolucion', 'Alertas']
const groupCells = (row) => [
  row.rutas,
  formatNumber(row.km_recorridos),
  formatNumber(row.consumo_galones),
  formatNumber(row.km_por_galon),
  costLabel(row),
  formatCurrency(row.costo_por_km_q),
  formatNumber(row.horas_promedio_ruta, 1),
  punctualityLabel(row),
  formatPercent(row.porcentaje_sin_devolucion),
  row.rutas_con_alertas,
]

const buildIndicatorsPdf = (report, { periodLabel, vehicleLabel }) => {
  const doc = new jsPDF({ orientation: 'landscape' })
  const tableStyles = { styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: PDF_HEAD_COLOR } }
  const { resumen } = report

  doc.setFontSize(14)
  doc.text('Indicadores de logistica', 14, 15)
  doc.setFontSize(10)
  doc.text(`Periodo: ${periodLabel}`, 14, 22)
  doc.text(`Vehiculo: ${vehicleLabel}`, 14, 27)
  doc.text(`Generado: ${new Date().toLocaleString('es-GT')}`, 14, 32)

  autoTable(doc, {
    startY: 38,
    head: [['Indicador', 'Valor']],
    body: [
      ['Rutas cerradas', String(resumen.rutas)],
      ['Km recorridos', formatNumber(resumen.km_recorridos)],
      ['Consumo de combustible (galones)', formatNumber(resumen.consumo_galones)],
      ['Rendimiento (km por galon)', formatNumber(resumen.km_por_galon)],
      ['Combustible facturado', `${formatCurrency(resumen.combustible_facturado_q)} (${formatNumber(resumen.galones_facturados)} gal)`],
      ['Costo del combustible consumido', costLabel(resumen)],
      ['Costo por km', formatCurrency(resumen.costo_por_km_q)],
      ['Duracion promedio de la ruta (horas)', formatNumber(resumen.horas_promedio_ruta, 1)],
      ['Puntualidad de las entregas', punctualityLabel(resumen)],
      ['Pedidos entregados sin devolucion', `${formatPercent(resumen.porcentaje_sin_devolucion)} (${resumen.pedidos_sin_devolucion}/${resumen.pedidos})`],
      ['Rutas con alertas de combustible', String(resumen.rutas_con_alertas)],
    ],
    tableWidth: 160,
    ...tableStyles,
  })

  if (report.por_mes.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Mes', ...GROUP_HEAD]],
      body: report.por_mes.map((row) => [formatMonth(row.mes), ...groupCells(row)]),
      ...tableStyles,
    })
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Vehiculo', ...GROUP_HEAD]],
      body: report.por_vehiculo.map((row) => [row.placa, ...groupCells(row)]),
      ...tableStyles,
    })
  }

  const withAlerts = report.rutas.filter((route) => route.alertas.length > 0)

  if (withAlerts.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Ruta', 'Fecha', 'Vehiculo', 'Piloto', 'Alertas de combustible']],
      body: withAlerts.map((route) => [`#${route.id_ruta}`, formatDate(route.fecha_llegada), route.placa, route.piloto, route.alertas.join('\n')]),
      ...tableStyles,
    })
  }

  doc.setFontSize(8)
  doc.text(
    '* Costo estimado con el precio de la ultima factura registrada. El nivel del tanque se lee en octavos, por lo que el rendimiento es mas preciso por mes y por vehiculo que por ruta.',
    14,
    doc.internal.pageSize.getHeight() - 8
  )

  return doc
}

function LogisticsIndicators({ token, vehicles }) {
  const [filters, setFilters] = useState({ desde: firstDayOfMonth(), hasta: toInputDate(new Date()), idVehiculo: '' })
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadReport = async () => {
    setErrorMessage('')
    setIsLoading(true)

    try {
      setReport(await getLogisticsIndicatorsRequest(filters, token))
    } catch (error) {
      setErrorMessage(error.message || 'No se pudieron cargar los indicadores')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // La carga cambia estado: se agenda fuera del cuerpo del efecto (regla set-state-in-effect).
    // Despues de abrir la vista, se vuelve a consultar con el boton.
    queueMicrotask(loadReport)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const handleExportPdf = () => {
    if (!report) {
      return
    }

    try {
      const vehicle = vehicles.find((item) => String(item.id_vehiculo) === String(filters.idVehiculo))
      const doc = buildIndicatorsPdf(report, {
        periodLabel: `${filters.desde || 'inicio'} al ${filters.hasta || 'hoy'}`,
        vehicleLabel: vehicle ? vehicle.placa : 'Todos',
      })
      doc.save(`indicadores_logistica_${filters.desde || 'inicio'}_${filters.hasta || 'hoy'}.pdf`)
    } catch (error) {
      notifyError(error.message || 'No se pudo generar el PDF')
    }
  }

  const resumen = report?.resumen

  return (
    <div>
      <div className="maturation-filter-panel">
        <div className="maturation-filter-grid">
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Desde</span>
            <input type="date" name="desde" value={filters.desde} onChange={handleFilterChange} className="maturation-filter-input" />
          </label>
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Hasta</span>
            <input type="date" name="hasta" value={filters.hasta} onChange={handleFilterChange} className="maturation-filter-input" />
          </label>
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Vehiculo</span>
            <select name="idVehiculo" value={filters.idVehiculo} onChange={handleFilterChange} className="maturation-filter-input">
              <option value="">Todos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                  {vehicle.placa}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="provider-form-actions" style={{ marginTop: 10 }}>
          <button type="button" onClick={loadReport} disabled={isLoading}>
            {isLoading ? 'Consultando...' : 'Consultar'}
          </button>
          <button type="button" className="secondary-button" onClick={handleExportPdf} disabled={!report || isLoading}>
            Exportar PDF
          </button>
        </div>
      </div>

      {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

      {resumen ? (
        <>
          <div className="inventory-summary logistics-summary">
            <div className="inventory-metric">
              <span>Rutas cerradas</span>
              <strong>{resumen.rutas}</strong>
              <small>{formatNumber(resumen.km_recorridos)} km recorridos</small>
            </div>
            <div className="inventory-metric">
              <span>Rendimiento</span>
              <strong>{formatNumber(resumen.km_por_galon)} km/gal</strong>
              <small>{formatNumber(resumen.consumo_galones)} gal consumidos</small>
            </div>
            <div className="inventory-metric">
              <span>Costo del combustible</span>
              <strong>{costLabel(resumen)}</strong>
              <small>{formatCurrency(resumen.costo_por_km_q)} por km</small>
            </div>
            <div className="inventory-metric">
              <span>Combustible facturado</span>
              <strong>{formatCurrency(resumen.combustible_facturado_q)}</strong>
              <small>{formatNumber(resumen.galones_facturados)} gal en facturas</small>
            </div>
            <div className="inventory-metric">
              <span>Duracion promedio</span>
              <strong>{formatNumber(resumen.horas_promedio_ruta, 1)} h</strong>
              <small>por ruta</small>
            </div>
            <div className="inventory-metric">
              <span>Puntualidad</span>
              <strong>{formatPercent(resumen.porcentaje_puntualidad)}</strong>
              <small>
                {resumen.pedidos_a_tiempo} de {resumen.pedidos_con_fecha_programada} pedidos a tiempo
              </small>
            </div>
            <div className="inventory-metric">
              <span>Sin devolucion</span>
              <strong>{formatPercent(resumen.porcentaje_sin_devolucion)}</strong>
              <small>
                {resumen.pedidos_sin_devolucion} de {resumen.pedidos} pedidos
              </small>
            </div>
            <div className={`inventory-metric ${resumen.rutas_con_alertas > 0 ? 'inventory-metric--expired' : ''}`}>
              <span>Alertas de combustible</span>
              <strong>{resumen.rutas_con_alertas}</strong>
              <small>{resumen.rutas_con_alertas === 1 ? 'ruta' : 'rutas'} con algo que no cuadra</small>
            </div>
          </div>

          <p className="widget-muted" style={{ marginTop: 8 }}>
            El consumo se calcula con la diferencia del nivel del tanque al salir y al llegar, mas los galones de las
            facturas. El marcador se lee en octavos, por eso el rendimiento es mas preciso por mes y por vehiculo que
            por ruta. {resumen.costo_estimado ? '* Incluye costos estimados con el precio de la ultima factura. ' : ''}
            {resumen.pedidos_sin_fecha_programada > 0
              ? `${resumen.pedidos_sin_fecha_programada} pedidos sin fecha programada no cuentan en la puntualidad.`
              : ''}
          </p>

          <h4 style={{ marginTop: 16 }}>Por mes</h4>
          <div className="providers-table-wrap">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  {GROUP_HEAD.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.por_mes.length === 0 ? (
                  <tr>
                    <td colSpan={GROUP_HEAD.length + 1} className="empty-table-cell">
                      No hay rutas cerradas en el periodo.
                    </td>
                  </tr>
                ) : null}
                {report.por_mes.map((row) => (
                  <tr key={row.mes}>
                    <td>{formatMonth(row.mes)}</td>
                    {groupCells(row).map((cell, index) => (
                      <td key={GROUP_HEAD[index]}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ marginTop: 16 }}>Por vehiculo</h4>
          <div className="providers-table-wrap">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Vehiculo</th>
                  {GROUP_HEAD.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.por_vehiculo.map((row) => (
                  <tr key={row.id_vehiculo}>
                    <td>{row.placa}</td>
                    {groupCells(row).map((cell, index) => (
                      <td key={GROUP_HEAD[index]}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ marginTop: 16 }}>Detalle por ruta</h4>
          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Cierre</th>
                  <th>Vehiculo</th>
                  <th>Piloto</th>
                  <th>Km</th>
                  <th>Consumo (gal)</th>
                  <th>Km/gal</th>
                  <th>Costo</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {report.rutas.map((route) => (
                  <tr key={route.id_ruta}>
                    <td>#{route.id_ruta}</td>
                    <td>{formatDate(route.fecha_llegada)}</td>
                    <td>{route.placa}</td>
                    <td>{route.piloto}</td>
                    <td>{formatNumber(route.km)}</td>
                    <td>{formatNumber(route.consumo)}</td>
                    <td>{formatNumber(route.km_por_galon)}</td>
                    <td>
                      {formatCurrency(route.costo)}
                      {route.costo_estimado ? ' *' : ''}
                    </td>
                    <td>
                      {route.alertas.length === 0 ? (
                        '-'
                      ) : (
                        <ul className="fuel-alert-list">
                          {route.alertas.map((alerta) => (
                            <li key={alerta}>{alerta}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default LogisticsIndicators
