import { useEffect, useState } from 'react'
import { getExpirationReportRequest } from '../../services/inventory.service'

const MAX_ITEMS = 3

const formatMoney = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 }).format(Number(value) || 0)

const formatQuantity = (value) =>
  new Intl.NumberFormat('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)

const describeDays = (days) => {
  if (days < 0) {
    return `Vencido hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`
  }

  if (days === 0) {
    return 'Vence hoy'
  }

  return `Vence en ${days} ${days === 1 ? 'dia' : 'dias'}`
}

// Producto vencido o por vencer (30 dias) con su valor, y la perdida por caducidad del mes:
// lo que llego a su fecha de vencimiento sin despacharse.
function ExpirationRiskWidget({ token }) {
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadWidgetData = async () => {
      setErrorMessage('')
      setIsLoading(true)

      try {
        setReport(await getExpirationReportRequest(token))
      } catch (error) {
        setErrorMessage(error.message || 'No se pudo cargar el indicador de caducidad')
      } finally {
        setIsLoading(false)
      }
    }

    loadWidgetData()
  }, [token])

  const vencido = report?.resumen?.vencido || { existencias: 0, valor: 0 }
  const porVencer = report?.resumen?.por_vencer || { existencias: 0, valor: 0 }
  const items = (report?.en_riesgo || []).slice(0, MAX_ITEMS)
  const monthlyLoss = report?.perdida_mensual || []
  const currentMonthLoss = monthlyLoss.length > 0 ? monthlyLoss[monthlyLoss.length - 1].valor : 0

  return (
    <article className="widget-card widget-card--compact widget-card--expiration" aria-label="Caducidad">
      <div className="widget-compact-header">
        <h3>Caducidad</h3>
        <span className="widget-badge">{report?.dias_alerta ?? 30} dias</span>
      </div>

      {isLoading ? <p className="widget-muted">Cargando caducidad...</p> : null}
      {errorMessage ? <p className="widget-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage && report ? (
        <>
          <div className="expiration-summary">
            <div className="expiration-summary-item expiration-summary-item--expired">
              <span>Vencido</span>
              <strong>{formatMoney(vencido.valor)}</strong>
              <small>
                {vencido.existencias} {vencido.existencias === 1 ? 'existencia' : 'existencias'}
              </small>
            </div>
            <div className="expiration-summary-item expiration-summary-item--warning">
              <span>Por vencer</span>
              <strong>{formatMoney(porVencer.valor)}</strong>
              <small>
                {porVencer.existencias} {porVencer.existencias === 1 ? 'existencia' : 'existencias'}
              </small>
            </div>
          </div>

          {items.length > 0 ? (
            <ul className="widget-list widget-list--compact">
              {items.map((item) => (
                <li key={item.id_existencia}>
                  <strong>
                    {item.producto_nombre || `Producto #${item.id_producto}`}
                    {item.codigo_trazabilidad ? ` · ${item.codigo_trazabilidad}` : ''}
                  </strong>
                  <span>{describeDays(item.dias_para_vencer)}</span>
                  <small>
                    {formatQuantity(item.cantidad)} {item.unidad_medida || ''} · {formatMoney(item.valor)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="widget-muted">No hay producto vencido ni por vencer.</p>
          )}

          <p className="widget-muted">Perdida por caducidad este mes: {formatMoney(currentMonthLoss)}</p>
        </>
      ) : null}
    </article>
  )
}

export default ExpirationRiskWidget
