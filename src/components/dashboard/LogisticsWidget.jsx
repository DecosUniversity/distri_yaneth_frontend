import { useEffect, useState } from 'react'
import { getLogisticsIndicatorsRequest } from '../../services/route.service'

const formatNumber = (value, decimals = 2) =>
  value === null || value === undefined
    ? '-'
    : new Intl.NumberFormat('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(Number(value))

const formatMoney = (value) =>
  value === null || value === undefined
    ? '-'
    : new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 }).format(Number(value))

const toInputDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

// Indicadores de logistica del mes en curso: rendimiento y costo del combustible, puntualidad
// de las entregas y rutas en las que el combustible no cuadra.
function LogisticsWidget({ token }) {
  const [resumen, setResumen] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadWidgetData = async () => {
      setErrorMessage('')
      setIsLoading(true)

      try {
        const today = new Date()
        const report = await getLogisticsIndicatorsRequest(
          { desde: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), hasta: toInputDate(today) },
          token
        )
        setResumen(report.resumen)
      } catch (error) {
        setErrorMessage(error.message || 'No se pudieron cargar los indicadores de logistica')
      } finally {
        setIsLoading(false)
      }
    }

    loadWidgetData()
  }, [token])

  return (
    <article className="widget-card widget-card--compact widget-card--expiration" aria-label="Logistica">
      <div className="widget-compact-header">
        <h3>Logistica del mes</h3>
        <span className="widget-badge">{resumen ? `${resumen.rutas} rutas` : '-'}</span>
      </div>

      {isLoading ? <p className="widget-muted">Cargando indicadores...</p> : null}
      {errorMessage ? <p className="widget-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage && resumen ? (
        <>
          <div className="expiration-summary">
            <div className="inventory-metric">
              <span>Rendimiento</span>
              <strong>{formatNumber(resumen.km_por_galon)} km/gal</strong>
            </div>
            <div className="inventory-metric">
              <span>Combustible</span>
              <strong>
                {formatMoney(resumen.costo_combustible_q)}
                {resumen.costo_estimado ? ' *' : ''}
              </strong>
            </div>
            <div className="inventory-metric">
              <span>Puntualidad</span>
              <strong>{resumen.porcentaje_puntualidad === null ? '-' : `${formatNumber(resumen.porcentaje_puntualidad, 1)} %`}</strong>
            </div>
            <div className={`inventory-metric ${resumen.rutas_con_alertas > 0 ? 'inventory-metric--expired' : ''}`}>
              <span>Alertas</span>
              <strong>{resumen.rutas_con_alertas}</strong>
            </div>
          </div>
          <p className="widget-muted">
            {resumen.rutas_con_alertas > 0
              ? 'Hay rutas en las que el combustible no cuadra: revisalas en Entregas > Indicadores.'
              : `${formatNumber(resumen.km_recorridos)} km recorridos este mes.`}
          </p>
        </>
      ) : null}
    </article>
  )
}

export default LogisticsWidget
