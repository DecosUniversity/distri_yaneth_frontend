import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { listInventoryRequest } from '../../services/inventory.service'
import { listProductsRequest } from '../../services/product.service'

const LOW_STOCK_ONLY_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Solo stock bajo', value: 'low' },
  { label: 'Solo stock normal', value: 'normal' },
]

const EMPTY_FILTERS = {
  search: '',
  tipo_producto: '',
  vencimiento_hasta: '',
  lowStock: 'all',
}

const EXPIRATION_WARNING_DAYS = 30

const formatNumber = (value) => {
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

const toStartOfDay = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  date.setHours(0, 0, 0, 0)
  return date
}

const isDateOnOrBefore = (left, right) => {
  if (!left || !right) {
    return true
  }

  const leftDate = toStartOfDay(left)
  const rightDate = toStartOfDay(right)

  if (!leftDate || !rightDate) {
    return true
  }

  return leftDate.getTime() <= rightDate.getTime()
}

const getExpirationStatus = (expirationDate) => {
  const expiration = toStartOfDay(expirationDate)

  if (!expiration) {
    return 'normal'
  }

  const today = toStartOfDay(new Date())
  const warningLimit = new Date(today)
  warningLimit.setDate(warningLimit.getDate() + EXPIRATION_WARNING_DAYS)

  if (expiration.getTime() < today.getTime()) {
    return 'expired'
  }

  if (expiration.getTime() <= warningLimit.getTime()) {
    return 'near'
  }

  return 'normal'
}

function InventoryModule({ token, isActive }) {
  const [inventoryRows, setInventoryRows] = useState([])
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [isLoading, setIsLoading] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadData = async () => {
    setErrorMessage('')
    setIsLoading(true)

    try {
      const [inventoryData, productsData] = await Promise.all([
        listInventoryRequest(token),
        listProductsRequest(token),
      ])

      setInventoryRows(Array.isArray(inventoryData) ? inventoryData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo cargar inventario')
    } finally {
      setIsLoading(false)
    }
  }

  const inventoryBuckets = useMemo(() => {
    const buildGroups = (rows, { includeStates, fruitMode = false }) => {
      const groups = new Map()

      rows.forEach((row) => {
        const rowState = String(row.estado_registro || '').toLowerCase()
        if (!includeStates.has(rowState)) {
          return
        }

        const productId = Number(row.id_producto)
        const quantity = Number(row.cantidad_disponible || 0)
        const expirationDate = row.fecha_vencimiento || null
        const expirationKey = expirationDate || ''
        const product = products.find((item) => Number(item.id_producto) === productId)
        const fallbackName = row.producto_nombre || `Producto #${productId}`
        const name = product ? product.nombre || fallbackName : fallbackName
        const tipo = fruitMode ? 'Fruta para produccion' : (product ? (product.tipo_producto || row.tipo_producto || '-') : (row.tipo_producto || '-'))
        const unidad = product ? product.unidad_medida || '-' : (row.unidad_medida || '-')
        const stockMinimo = fruitMode ? 0 : (product ? Number(product.stock_minimo ?? 0) : 0)
        const key = fruitMode
          ? `${productId}::${expirationKey}`
          : `${productId}::${expirationKey}::${tipo}`

        const existing = groups.get(key)
        if (!existing) {
          groups.set(key, {
            id_producto: productId,
            nombre: name,
            tipo_producto: tipo,
            unidad_medida: unidad,
            stock_minimo: stockMinimo,
            stock_actual: quantity,
            fecha_vencimiento: expirationDate,
          })
          return
        }

        existing.stock_actual += quantity
        if (!existing.fecha_vencimiento) {
          existing.fecha_vencimiento = expirationDate
        }
      })

      return Array.from(groups.values()).map((item) => {
        const expirationStatus = getExpirationStatus(item.fecha_vencimiento)
        const isLowStock = fruitMode ? false : item.stock_actual <= (item.stock_minimo || 0)

        return {
          ...item,
          fruta_stock_actual: fruitMode ? item.stock_actual : 0,
          isLowStock,
          expirationStatus,
          stock_status: fruitMode ? 'Fruta para produccion' : (isLowStock ? 'Stock bajo' : 'Stock normal'),
          expiration_status_label:
            expirationStatus === 'expired'
              ? 'Vencido'
              : expirationStatus === 'near'
                ? 'Vencimiento cercano'
                : 'Vigente',
        }
      })
    }

    const generalRows = buildGroups(inventoryRows, {
      includeStates: new Set(['pendiente', 'activo']),
      fruitMode: false,
    })

    const frutaRows = buildGroups(inventoryRows, {
      includeStates: new Set(['completo']),
      fruitMode: true,
    })

    const matchesFilters = (item, { ignoreLowStock = false } = {}) => {
      const searchTerm = filters.search.trim().toLowerCase()
      const matchesSearch = !searchTerm || `${item.nombre} ${item.tipo_producto} ${item.unidad_medida}`.toLowerCase().includes(searchTerm)
      const matchesType = !filters.tipo_producto || item.tipo_producto === filters.tipo_producto
      const matchesLowStock =
        ignoreLowStock ||
        filters.lowStock === 'all' ||
        (filters.lowStock === 'low' ? item.isLowStock : !item.isLowStock)
      const matchesExpiration = !filters.vencimiento_hasta || isDateOnOrBefore(item.fecha_vencimiento, filters.vencimiento_hasta)
      return matchesSearch && matchesType && matchesLowStock && matchesExpiration
    }

    const sortInventory = (left, right) => {
      const statusRank = { expired: 0, near: 1, normal: 2 }
      if (left.expirationStatus !== right.expirationStatus) {
        return statusRank[left.expirationStatus] - statusRank[right.expirationStatus]
      }
      if (left.isLowStock !== right.isLowStock) {
        return left.isLowStock ? -1 : 1
      }
      const leftExpiration = left.fecha_vencimiento ? new Date(left.fecha_vencimiento).getTime() : Number.POSITIVE_INFINITY
      const rightExpiration = right.fecha_vencimiento ? new Date(right.fecha_vencimiento).getTime() : Number.POSITIVE_INFINITY
      return leftExpiration - rightExpiration
    }

    return {
      generalInventory: generalRows.filter((item) => matchesFilters(item)).sort(sortInventory),
      frutaInventory: frutaRows.filter((item) => matchesFilters(item, { ignoreLowStock: true })).sort(sortInventory),
    }
  }, [filters.search, filters.tipo_producto, filters.lowStock, filters.vencimiento_hasta, inventoryRows, products])

  const generalInventory = inventoryBuckets.generalInventory
  const frutaInventory = inventoryBuckets.frutaInventory

  const inventorySummary = useMemo(() => {
    const totalProducts = generalInventory.length
    const lowStockCount = generalInventory.filter((item) => item.isLowStock).length
    const nearExpirationCount = generalInventory.filter((item) => item.expirationStatus === 'near').length
    const expiredCount = generalInventory.filter((item) => item.expirationStatus === 'expired').length

    return {
      totalProducts,
      lowStockCount,
      nearExpirationCount,
      expiredCount,
    }
  }, [generalInventory])

  const uniqueTypes = useMemo(() => {
    const types = new Set([
      ...generalInventory.map((item) => item.tipo_producto),
      ...frutaInventory.map((item) => item.tipo_producto),
    ].filter(Boolean))
    return Array.from(types)
  }, [generalInventory, frutaInventory])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
  }

  const handleDownloadPdf = () => {
    const printableInventory = [...generalInventory, ...frutaInventory]

    if (printableInventory.length === 0) {
      setErrorMessage('No hay inventario para exportar')
      setNoticeMessage('')
      return
    }

    setErrorMessage('')
    setNoticeMessage('')
    setIsExportingPdf(true)

    try {
      const doc = new jsPDF({ orientation: 'landscape' })
      const generatedAt = new Date().toLocaleString('es-GT')

      doc.setFontSize(14)
      doc.text('Reporte de Inventario', 14, 15)
      doc.setFontSize(10)
      doc.text(`Generado: ${generatedAt}`, 14, 22)

      autoTable(doc, {
        startY: 28,
        head: [['Producto', 'Tipo', 'Unidad', 'Stock actual', 'Stock min.', 'Estado', 'Vencimiento']],
        body: printableInventory.map((item) => [
          item.nombre,
          item.tipo_producto,
          item.unidad_medida,
          formatNumber(item.stock_actual),
          formatNumber(item.stock_minimo),
          item.stock_status,
          formatDate(item.fecha_vencimiento),
        ]),
        styles: {
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [31, 111, 59],
        },
      })

      const safeDate = new Date().toISOString().slice(0, 10)
      doc.save(`inventario_${safeDate}.pdf`)
      setNoticeMessage('PDF descargado correctamente')
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo generar el PDF')
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de inventario">
      <div className="providers-header-row">
        <div>
          <h3>Inventario</h3>
          <p>Consulta el stock por producto, el estado de stock bajo y su fecha de vencimiento.</p>
        </div>

        <div className="provider-form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadPdf}
              disabled={isLoading || isExportingPdf || (generalInventory.length + frutaInventory.length === 0)}
          >
            {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={loadData}
            disabled={isLoading}
          >
            {isLoading ? 'Actualizando...' : 'Recargar'}
          </button>
        </div>
      </div>

      <form className="provider-form" onSubmit={(event) => event.preventDefault()}>
        <div className="provider-form-grid">
          <label>
            Buscar
            <input
              name="search"
              type="text"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Nombre, tipo o unidad"
            />
          </label>

          <label>
            Tipo de producto
            <select name="tipo_producto" value={filters.tipo_producto} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vencimiento hasta
            <input
              name="vencimiento_hasta"
              type="date"
              value={filters.vencimiento_hasta}
              onChange={handleFilterChange}
            />
          </label>

          <label>
            Estado de stock
            <select name="lowStock" value={filters.lowStock} onChange={handleFilterChange}>
              {LOW_STOCK_ONLY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="button" className="secondary-button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </form>

      {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
      {noticeMessage ? <p className="feedback success">{noticeMessage}</p> : null}

      <div className="inventory-summary">
        <article className="inventory-metric">
          <span>Total productos</span>
          <strong>{inventorySummary.totalProducts}</strong>
        </article>
        <article className="inventory-metric">
          <span>Stock bajo</span>
          <strong>{inventorySummary.lowStockCount}</strong>
        </article>
        <article className="inventory-metric">
          <span>Vencimientos cercanos</span>
          <strong>{inventorySummary.nearExpirationCount}</strong>
        </article>
        <article className="inventory-metric inventory-metric--expired">
          <span>Vencidos</span>
          <strong>{inventorySummary.expiredCount}</strong>
        </article>
      </div>

      {frutaInventory.length > 0 ? (
        <section className="panel-card" aria-label="Fruta para produccion">
          <div className="providers-header-row">
            <div>
              <h4>Fruta para producción</h4>
              <p>Productos completados listos para producción.</p>
            </div>
          </div>

          <div className="providers-table-wrap table-limited">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Unidad</th>
                  <th>Stock actual</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {frutaInventory.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan="6" className="empty-table-cell">
                      No hay productos en esta categoría.
                    </td>
                  </tr>
                ) : null}

                {frutaInventory.map((item) => (
                  <tr
                    key={`fruta-${item.id_producto}-${item.tipo_producto}-${item.fecha_vencimiento || 'sin-vencimiento'}`}
                    className={
                      item.expirationStatus === 'expired'
                        ? 'inventory-row-expired'
                        : item.expirationStatus === 'near'
                          ? 'inventory-row-warning'
                          : ''
                    }
                  >
                    <td>{item.nombre}</td>
                    <td>{item.tipo_producto}</td>
                    <td>{item.unidad_medida}</td>
                    <td>{formatNumber(item.fruta_stock_actual ?? item.stock_actual)}</td>
                    <td>
                      <span
                        className={`inventory-status ${
                          item.expirationStatus === 'expired'
                            ? 'expired'
                            : item.expirationStatus === 'near'
                              ? 'warning'
                              : 'normal'
                        }`}
                      >
                        {item.expirationStatus === 'expired'
                          ? 'Vencido'
                          : item.expirationStatus === 'near'
                            ? 'Vencimiento cercano'
                            : 'Vigente'}
                      </span>
                    </td>
                    <td>{formatDate(item.fecha_vencimiento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Stock actual</th>
              <th>Stock minimo</th>
              <th>Estado</th>
              <th>Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {generalInventory.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No hay productos en inventario para mostrar.
                </td>
              </tr>
            ) : null}

            {generalInventory.map((item) => (
              <tr
                key={`inv-${item.id_producto}-${item.tipo_producto}-${item.fecha_vencimiento || 'sin-vencimiento'}`}
                className={
                  item.expirationStatus === 'expired'
                    ? 'inventory-row-expired'
                    : item.expirationStatus === 'near'
                      ? 'inventory-row-warning'
                      : item.isLowStock
                        ? 'inventory-row-low'
                        : ''
                }
              >
                <td>{item.nombre}</td>
                <td>{item.tipo_producto}</td>
                <td>{item.unidad_medida}</td>
                <td>{formatNumber(item.stock_actual)}</td>
                <td>{formatNumber(item.stock_minimo)}</td>
                <td>
                  <span
                    className={`inventory-status ${
                      item.expirationStatus === 'expired'
                        ? 'expired'
                        : item.expirationStatus === 'near'
                          ? 'warning'
                          : item.isLowStock
                            ? 'low'
                            : 'normal'
                    }`}
                  >
                    {item.expirationStatus === 'expired'
                      ? 'Vencido'
                      : item.expirationStatus === 'near'
                        ? 'Vencimiento cercano'
                        : item.stock_status}
                  </span>
                </td>
                <td>{formatDate(item.fecha_vencimiento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default InventoryModule