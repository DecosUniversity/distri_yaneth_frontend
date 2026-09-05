import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getMermasPorCategoriaReportRequest,
  getProduccionPorProductoReportRequest,
} from '../../services/production.service'
import { getPedidosDelDiaReportRequest } from '../../services/order.service'
import { listInventoryRequest } from '../../services/inventory.service'
import CollapsibleSection from './CollapsibleSection'

const CHART_COLOR = '#2f7035'
const INVENTORY_TOP_N = 10

const formatDateLabel = (value) => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-')
    return `${day}/${month}/${year}`
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-GT')
}

// Validated categorical order (CVD-safe adjacent pairs) - see dataviz skill references/palette.md
const CATEGORICAL_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]
const PIE_OTHER_COLOR = '#898781'
const PIE_MAX_SLICES = 8

const buildPieData = (data, nameKey, valueKey) => {
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }

  const sorted = [...data].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0))

  if (sorted.length <= PIE_MAX_SLICES) {
    return sorted.map((row, index) => ({
      name: row[nameKey],
      value: Number(row[valueKey]) || 0,
      color: CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
    }))
  }

  const head = sorted.slice(0, PIE_MAX_SLICES - 1).map((row, index) => ({
    name: row[nameKey],
    value: Number(row[valueKey]) || 0,
    color: CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
  }))

  const restTotal = sorted.slice(PIE_MAX_SLICES - 1).reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0)

  return [...head, { name: 'Otros', value: restTotal, color: PIE_OTHER_COLOR }]
}

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

function ChartCard({ title, subtitle, data, nameKey, nameLabel, valueKey, valueLabel, unitAccessor, emptyMessage }) {
  const [chartType, setChartType] = useState('bar')
  const hasData = Array.isArray(data) && data.length > 0
  const showLabels = hasData && data.length <= 8
  const manyCategories = hasData && data.length > 5

  const pieData = useMemo(() => buildPieData(data, nameKey, valueKey), [data, nameKey, valueKey])

  return (
    <article className="widget-card" aria-label={title}>
      <div className="widget-compact-header">
        <h3>{title}</h3>
        {hasData ? (
          <div className="chart-type-toggle" role="group" aria-label={`Tipo de grafica para ${title}`}>
            <button
              type="button"
              className={`chart-type-toggle-button ${chartType === 'bar' ? 'is-active' : ''}`}
              onClick={() => setChartType('bar')}
              aria-pressed={chartType === 'bar'}
            >
              Barras
            </button>
            <button
              type="button"
              className={`chart-type-toggle-button ${chartType === 'pie' ? 'is-active' : ''}`}
              onClick={() => setChartType('pie')}
              aria-pressed={chartType === 'pie'}
            >
              Circular
            </button>
          </div>
        ) : null}
      </div>
      {subtitle ? <p className="widget-muted" style={{ margin: '0 0 12px' }}>{subtitle}</p> : null}

      {!hasData ? (
        <p className="widget-muted">{emptyMessage || 'Aun no hay datos suficientes para graficar.'}</p>
      ) : chartType === 'pie' ? (
        <>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  outerRadius="72%"
                  paddingAngle={pieData.length > 1 ? 1 : 0}
                  stroke="#fcfcfb"
                  strokeWidth={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${formatNumber(value)}${unitAccessor ? ` ${unitAccessor({ [valueKey]: value })}` : ''}`,
                    name,
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: '#bdd9a8', fontSize: 12 }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: 11, color: '#4b5f45' }}
                  formatter={(value) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-data-table-wrap">
            <table className="chart-data-table">
              <thead>
                <tr>
                  <th title={nameLabel || title}>{nameLabel || title}</th>
                  <th>{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={`${row[nameKey]}-${index}`}>
                    <td title={row[nameKey]}>{row[nameKey]}</td>
                    <td>
                      {formatNumber(row[valueKey])}
                      {unitAccessor ? ` ${unitAccessor(row)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: showLabels ? 22 : 8, right: 8, left: 0, bottom: manyCategories ? 46 : 8 }}>
                <CartesianGrid vertical={false} stroke="#d8e5d3" />
                <XAxis
                  dataKey={nameKey}
                  tick={{ fontSize: 11, fill: '#4b5f45' }}
                  interval={0}
                  angle={manyCategories ? -25 : 0}
                  textAnchor={manyCategories ? 'end' : 'middle'}
                  height={manyCategories ? 56 : 30}
                />
                <YAxis tick={{ fontSize: 11, fill: '#4b5f45' }} allowDecimals={false} width={40} />
                <Tooltip
                  formatter={(value, _key, item) => [
                    `${formatNumber(value)}${unitAccessor ? ` ${unitAccessor(item.payload)}` : ''}`,
                    valueLabel,
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: '#bdd9a8', fontSize: 12 }}
                  cursor={{ fill: '#f4f9ef' }}
                />
                <Bar dataKey={valueKey} fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24}>
                  {showLabels ? (
                    <LabelList dataKey={valueKey} position="top" formatter={formatNumber} style={{ fontSize: 11, fill: CHART_COLOR }} />
                  ) : null}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-data-table-wrap">
            <table className="chart-data-table">
              <thead>
                <tr>
                  <th title={nameLabel || title}>{nameLabel || title}</th>
                  <th>{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={`${row[nameKey]}-${index}`}>
                    <td title={row[nameKey]}>{row[nameKey]}</td>
                    <td>
                      {formatNumber(row[valueKey])}
                      {unitAccessor ? ` ${unitAccessor(row)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  )
}

function DashboardCharts({ token, showProductionCharts = true, showOrderCharts = true, showInventoryCharts = true }) {
  const [produccionPorProducto, setProduccionPorProducto] = useState([])
  const [mermasPorCategoria, setMermasPorCategoria] = useState([])
  const [pedidosDelDia, setPedidosDelDia] = useState([])
  const [pedidosDelDiaFecha, setPedidosDelDiaFecha] = useState(null)
  const [existenciasPorProducto, setExistenciasPorProducto] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCancelled = false

    const loadCharts = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const requests = []

        if (showProductionCharts) {
          requests.push(
            getProduccionPorProductoReportRequest(token).then((rows) => {
              if (!isCancelled) {
                setProduccionPorProducto(
                  (Array.isArray(rows) ? rows : []).map((row) => ({ nombre: row.producto_nombre, kg: Number(row.total_kg) || 0 }))
                )
              }
            }),
            getMermasPorCategoriaReportRequest(token).then((rows) => {
              if (!isCancelled) {
                setMermasPorCategoria(
                  (Array.isArray(rows) ? rows : []).map((row) => ({ nombre: row.nombre_merma, kg: Number(row.total_kg) || 0 }))
                )
              }
            })
          )
        }

        if (showOrderCharts) {
          requests.push(
            getPedidosDelDiaReportRequest({}, token).then((report) => {
              if (isCancelled) {
                return
              }

              setPedidosDelDiaFecha(report?.fecha || null)
              setPedidosDelDia([
                { estado: 'Pendientes de entrega', pedidos: Number(report?.pendientes) || 0 },
                { estado: 'Entregados', pedidos: Number(report?.entregados) || 0 },
                { estado: 'Con devolucion', pedidos: Number(report?.con_devolucion) || 0 },
              ])
            })
          )
        }

        if (showInventoryCharts) {
          requests.push(
            listInventoryRequest(token).then((rows) => {
              if (isCancelled) {
                return
              }

              const totalsByProduct = new Map()

              ;(Array.isArray(rows) ? rows : []).forEach((existencia) => {
                const key = existencia.producto_nombre || `Producto #${existencia.id_producto}`
                const previous = totalsByProduct.get(key) || { nombre: key, cantidad: 0, tipo: existencia.tipo_producto }
                previous.cantidad += Number(existencia.cantidad_disponible) || 0
                totalsByProduct.set(key, previous)
              })

              const sorted = Array.from(totalsByProduct.values())
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, INVENTORY_TOP_N)

              setExistenciasPorProducto(sorted)
            })
          )
        }

        await Promise.all(requests)
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(error.message || 'No se pudieron cargar las graficas')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadCharts()

    return () => {
      isCancelled = true
    }
  }, [token, showProductionCharts, showOrderCharts, showInventoryCharts])

  if (!showProductionCharts && !showOrderCharts && !showInventoryCharts) {
    return null
  }

  return (
    <CollapsibleSection
      title="Graficas"
      subtitle="Resumen grafico de los datos del sistema."
      storageKey="dashboard:collapsed:charts"
    >
      {isLoading ? <p className="widget-muted">Cargando graficas...</p> : null}
      {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

      <div className="dashboard-charts-grid">
        {showProductionCharts ? (
          <ChartCard
            title="Kg producidos por producto"
            subtitle=""
            data={produccionPorProducto}
            nameKey="nombre"
            nameLabel="Producto"
            valueKey="kg"
            valueLabel="Kg"
            unitAccessor={() => 'kg'}
            emptyMessage="Aun no hay procesos de produccion finalizados."
          />
        ) : null}

        {showProductionCharts ? (
          <ChartCard
            title="Mermas por categoria"
            subtitle="Todas las mermas registradas en produccion"
            data={mermasPorCategoria}
            nameKey="nombre"
            nameLabel="Categoria"
            valueKey="kg"
            valueLabel="Kg"
            unitAccessor={() => 'kg'}
            emptyMessage="Aun no hay mermas registradas."
          />
        ) : null}

        {showOrderCharts ? (
          <ChartCard
            title="Pedidos del dia"
            subtitle={pedidosDelDiaFecha ? `Corte al ${formatDateLabel(pedidosDelDiaFecha)}` : ''}
            data={pedidosDelDia}
            nameKey="estado"
            nameLabel="Estado"
            valueKey="pedidos"
            valueLabel="Pedidos"
            emptyMessage="Aun no hay pedidos registrados hoy."
          />
        ) : null}

        {showInventoryCharts ? (
          <ChartCard
            title="Existencias por producto"
            subtitle={`Top ${INVENTORY_TOP_N} productos con mayor existencia disponible`}
            data={existenciasPorProducto}
            nameKey="nombre"
            nameLabel="Producto"
            valueKey="cantidad"
            valueLabel="Cantidad"
            emptyMessage="Aun no hay existencias registradas."
          />
        ) : null}
      </div>
    </CollapsibleSection>
  )
}

export default DashboardCharts
