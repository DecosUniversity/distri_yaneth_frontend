import { useEffect, useMemo, useState } from 'react'
import { listMaturationControlsRequest, listMaturationLotsRequest } from '../../services/maturation.service'

const MAX_ITEMS = 4

const formatBrix = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-GT')
}

function UpcomingMaturationLotsWidget({ token }) {
  const [lots, setLots] = useState([])
  const [controls, setControls] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadWidgetData = async () => {
      setErrorMessage('')
      setIsLoading(true)

      try {
        const [lotsData, controlsData] = await Promise.all([
          listMaturationLotsRequest(token),
          listMaturationControlsRequest(token),
        ])

        setLots(Array.isArray(lotsData) ? lotsData : [])
        setControls(Array.isArray(controlsData) ? controlsData : [])
      } catch (error) {
        setErrorMessage(error.message || 'No se pudieron cargar los lotes de maduracion')
      } finally {
        setIsLoading(false)
      }
    }

    loadWidgetData()
  }, [token])

  const upcomingLots = useMemo(() => {
    const latestControlByLot = new Map()

    controls.forEach((control) => {
      const lotId = Number(control.id_lote_mp)
      const current = latestControlByLot.get(lotId)

      if (!current) {
        latestControlByLot.set(lotId, control)
        return
      }

      const currentDate = new Date(current.fecha_medicion || 0).getTime()
      const nextDate = new Date(control.fecha_medicion || 0).getTime()

      if (nextDate >= currentDate) {
        latestControlByLot.set(lotId, control)
      }
    })

    return lots
      .map((lot) => {
        const latestControl = latestControlByLot.get(Number(lot.id_lote_mp)) || null

        return {
          id: lot.id_lote_mp,
          label: `${lot.producto_nombre || 'Producto'} · ${lot.proveedor_nombre || 'Proveedor'}`,
          state: lot.estado_maduracion || '-',
          lastBrix: latestControl ? latestControl.grados_brix : null,
          lastMeasuredAt: latestControl ? latestControl.fecha_medicion : null,
        }
      })
      .sort((left, right) => {
        const leftScore = left.lastMeasuredAt ? new Date(left.lastMeasuredAt).getTime() : 0
        const rightScore = right.lastMeasuredAt ? new Date(right.lastMeasuredAt).getTime() : 0

        return rightScore - leftScore
      })
      .slice(0, MAX_ITEMS)
  }, [controls, lots])

  return (
    <article className="widget-card widget-card--compact widget-card--maturation" aria-label="Lotes de maduracion">
      <div className="widget-compact-header">
        <h3>Lotes maduracion</h3>
        <span className="widget-badge">brix</span>
      </div>

      {isLoading ? <p className="widget-muted">Cargando lotes...</p> : null}
      {errorMessage ? <p className="widget-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage ? (
        upcomingLots.length > 0 ? (
          <ul className="widget-list widget-list--compact">
            {upcomingLots.map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong>
                <span>Estado: {item.state}</span>
                <small>
                  {item.lastBrix === null
                    ? 'Sin mediciones Brix'
                    : `Ultimo Brix: ${formatBrix(item.lastBrix)} · ${formatDate(item.lastMeasuredAt)}`}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="widget-muted">No hay lotes de maduracion para mostrar.</p>
        )
      ) : null}
    </article>
  )
}

export default UpcomingMaturationLotsWidget