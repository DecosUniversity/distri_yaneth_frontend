import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { listProvidersRequest } from '../../services/provider.service'
import { listProductsRequest } from '../../services/product.service'
import { listMaturationLotsRequest } from '../../services/maturation.service'
import { buildTraceabilityCode, downloadTraceabilityLabelPdf } from '../../utils/traceabilityLabel'
import {
  createEntradaMercanciaRequest,
  deleteEntradaMercanciaRequest,
  listExistenciasRequest,
  listEntradasMercanciaRequest,
  listUnitsByEntradaRequest,
} from '../../services/entradas_mercancia.service'

const EMPTY_ENTRY_FORM = {
  id_proveedor: '',
  id_producto: '',
  fecha_vencimiento: '',
  costo_unitario: '',
  documento_referencia: '',
}

const ALLOWED_ENTRY_PRODUCT_TYPES = ['Materia Prima', 'Insumo']

const normalizeEntryPayload = (entryForm) => ({
  id_proveedor: Number(entryForm.id_proveedor),
  id_producto: Number(entryForm.id_producto),
  fecha_vencimiento: entryForm.fecha_vencimiento,
  costo_unitario:
    entryForm.costo_unitario === '' ? undefined : Number(entryForm.costo_unitario),
  documento_referencia: entryForm.documento_referencia.trim() || undefined,
  unidades: undefined,
})

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-GT') : '-')

const formatDateOnly = (value) => (value ? new Date(value).toLocaleDateString('es-GT') : '-')

const isExpiredDate = (value) => {
  if (!value) {
    return false
  }

  const expirationDate = new Date(`${value}T23:59:59`)
  return Number.isFinite(expirationDate.getTime()) && expirationDate < new Date()
}

const formatQuantity = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  return Number(value).toFixed(2)
}

const ALLOWED_ENTRY_RECORD_STATES = new Set(['pendiente', 'activo'])

const getEntryRecordState = (entry) =>
  String(
    entry?.estado_registro ??
    entry?.estado ??
    entry?.estado_maduracion ??
    ''
  )
    .trim()
    .toLowerCase()

const isVisibleEntryRecord = (entry) => ALLOWED_ENTRY_RECORD_STATES.has(getEntryRecordState(entry))

const LOTE_PENDING_STATE = 'pendiente'

function EntriesModule({ token, userName, isActive }) {
  const [entries, setEntries] = useState([])
  const [existencias, setExistencias] = useState([])
  const [providers, setProviders] = useState([])
  const [products, setProducts] = useState([])
  const [maturationLots, setMaturationLots] = useState([])
  const [viewMode, setViewMode] = useState('gestion')
  const [consultaSearchTerm, setConsultaSearchTerm] = useState('')
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY_FORM)
  const [units, setUnits] = useState([])
  const [addUnitModalOpen, setAddUnitModalOpen] = useState(false)
  const [newUnit, setNewUnit] = useState({ peso: '', fecha_pesos: '' })
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [isEntriesLoading, setIsEntriesLoading] = useState(false)
  const [isEntrySubmitting, setIsEntrySubmitting] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [entriesError, setEntriesError] = useState('')
  const [entriesNotice, setEntriesNotice] = useState('')
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    confirmLabel: 'Si, eliminar',
    cancelLabel: 'Cancelar',
    onConfirm: null,
  })
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailUnits, setDetailUnits] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEntry, setDetailEntry] = useState(null)
  const [entryUnitSummary, setEntryUnitSummary] = useState({})
  const [existenciasFilter, setExistenciasFilter] = useState({
    id_producto: '',
    id_proveedor: '',
    vencimiento_hasta: '',
    search: '',
  })

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadInitialData = async () => {
    setEntriesError('')
    setIsEntriesLoading(true)

    try {
      const [entriesData, providersData, productsData, existenciasData, maturationLotsData] = await Promise.all([
        listEntradasMercanciaRequest(token),
        listProvidersRequest(token),
        listProductsRequest(token),
        listExistenciasRequest(token),
        listMaturationLotsRequest(token),
      ])

      const normalizedEntries = (Array.isArray(entriesData) ? entriesData : []).filter(isVisibleEntryRecord)
      setEntries(normalizedEntries)
      setProviders(Array.isArray(providersData) ? providersData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setExistencias(Array.isArray(existenciasData) ? existenciasData : [])
      setMaturationLots(Array.isArray(maturationLotsData) ? maturationLotsData : [])

      if (normalizedEntries.length > 0) {
        const unitSummaries = await Promise.all(
          normalizedEntries.map(async (entry) => {
            try {
              const unitsData = await listUnitsByEntradaRequest(entry.id_entrada, token)
              const unitsList = Array.isArray(unitsData) ? unitsData : []
              const totalWeight = unitsList.reduce((sum, unit) => sum + (Number(unit.peso) || 0), 0)

              return [entry.id_entrada, { count: unitsList.length, totalWeight }]
            } catch {
              return [entry.id_entrada, { count: 0, totalWeight: 0 }]
            }
          })
        )

        setEntryUnitSummary(Object.fromEntries(unitSummaries))
      } else {
        setEntryUnitSummary({})
      }
    } catch (error) {
      setEntriesError(error.message || 'No se pudieron cargar las entradas')
    } finally {
      setIsEntriesLoading(false)
    }
  }

  const handleEntryFieldChange = (event) => {
    const { name, value } = event.target
    setEntryForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const entryProducts = products.filter((product) =>
    ALLOWED_ENTRY_PRODUCT_TYPES.includes(product.tipo_producto)
  )
  const visibleEntries = entries.filter(isVisibleEntryRecord)

  const lotesByEntrada = useMemo(() => {
    const map = new Map()

    maturationLots.forEach((lote) => {
      if (lote.id_entrada_origen !== null && lote.id_entrada_origen !== undefined) {
        map.set(String(lote.id_entrada_origen), lote)
      }
    })

    return map
  }, [maturationLots])

  const isEntryPendingLote = (entry) => {
    const lote = lotesByEntrada.get(String(entry.id_entrada))

    if (!lote) {
      return false
    }

    return String(lote.estado_registro).trim().toLowerCase() === LOTE_PENDING_STATE
  }

  const gestionEntries = visibleEntries.filter(isEntryPendingLote)

  const consultaEntries = useMemo(() => {
    const term = consultaSearchTerm.trim().toLowerCase()

    if (!term) {
      return visibleEntries
    }

    return visibleEntries.filter((entry) => {
      const lote = lotesByEntrada.get(String(entry.id_entrada))

      return `${entry.nombre_empresa || ''} ${entry.producto_nombre || ''} ${entry.documento_referencia || ''} ${entry.receptor_nombre || ''} ${lote?.estado_registro || ''}`
        .toLowerCase()
        .includes(term)
    })
  }, [visibleEntries, consultaSearchTerm, lotesByEntrada])

  const getProductUnitMeasure = (productId) => {
    const product = products.find((item) => String(item.id_producto) === String(productId))
    return product?.unidad_medida || 'kg'
  }

  const selectedEntryUnit = getProductUnitMeasure(entryForm.id_producto)

  const openEntryModal = () => {
    setEntriesError('')
    setEntriesNotice('')
    setEntryModalOpen(true)
  }

  const closeEntryModal = () => {
    if (isEntrySubmitting) {
      return
    }

    setEntryModalOpen(false)
  }

  const handleAddUnit = () => {
    setNewUnit({ peso: '', fecha_pesos: '' })
    setAddUnitModalOpen(true)
  }

  const handleAddUnitSubmit = () => {
    setUnits((prev) => {
      const next = [...prev, { unidad_codigo: String(prev.length + 1), peso: newUnit.peso || '', fecha_pesos: newUnit.fecha_pesos || '' }]
      return next
    })
    setAddUnitModalOpen(false)
  }

  const handleNewUnitFieldChange = (field, value) => {
    setNewUnit((prev) => ({ ...prev, [field]: value }))
  }

  const handleRemoveUnit = (index) => {
    const unitLabel = units[index]?.unidad_codigo || index + 1

    setConfirmModalConfig({
      title: 'Eliminar unidad',
      message: `Estas seguro de eliminar la unidad ${unitLabel}?`,
      confirmLabel: 'Si, eliminar',
      cancelLabel: 'Cancelar',
      onConfirm: () => {
        setUnits((prev) => {
          const filtered = prev.filter((_, i) => i !== index)
          return filtered.map((u, idx) => ({ ...u, unidad_codigo: String(idx + 1) }))
        })
        setConfirmModalOpen(false)
      },
    })

    setConfirmModalOpen(true)
  }

  const handleUnitChange = (index, field, value) => {
    setUnits((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const unitsTotalWeight = units.reduce((sum, u) => sum + (u && u.peso ? Number(u.peso) : 0), 0)

  const handleEntrySubmit = async (event) => {
    event.preventDefault()
    setEntriesError('')
    setEntriesNotice('')
    setIsEntrySubmitting(true)

    try {
      const payload = normalizeEntryPayload(entryForm)

      if (!Array.isArray(units) || units.length === 0) {
        setEntriesError('Añade al menos una unidad con su peso para registrar la entrada')
        setIsEntrySubmitting(false)
        return
      }

      const totalWeight = units.reduce((sum, unit) => sum + (Number(unit.peso) || 0), 0)

      if (Number.isNaN(totalWeight) || totalWeight <= 0) {
        setEntriesError('El peso total debe ser mayor a 0')
        setIsEntrySubmitting(false)
        return
      }

      payload.cantidad_disponible = totalWeight
      payload.unidades = units.map((u, idx) => ({
        unidad_codigo: String(idx + 1),
        peso: Number(u.peso) || 0,
        fecha_pesos: u.fecha_pesos || undefined,
      }))

      await createEntradaMercanciaRequest(payload, token)
      setEntriesNotice('Entrada de mercancia registrada correctamente')
      setEntryForm(EMPTY_ENTRY_FORM)
      setUnits([])
      setEntryModalOpen(false)
      await loadInitialData()
    } catch (error) {
      setEntriesError(error.message || 'No se pudo registrar la entrada')
    } finally {
      setIsEntrySubmitting(false)
    }
  }

  const handleEntryDelete = async (entryId) => {
    setConfirmModalConfig({
      title: 'Eliminar entrada',
      message: 'Estas seguro de eliminar esta entrada? Esta accion no se puede deshacer.',
      confirmLabel: 'Si, eliminar',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        setConfirmModalOpen(false)
        setEntriesError('')
        setEntriesNotice('')

        try {
          await deleteEntradaMercanciaRequest(entryId, token)
          setEntriesNotice('Entrada eliminada correctamente')
          await loadInitialData()
        } catch (error) {
          setEntriesError(error.message || 'No se pudo eliminar la entrada')
        }
      },
    })

    setConfirmModalOpen(true)
  }

  const closeConfirmModal = () => {
    setConfirmModalOpen(false)
    setConfirmModalConfig({
      title: '',
      message: '',
      confirmLabel: 'Si, eliminar',
      cancelLabel: 'Cancelar',
      onConfirm: null,
    })
  }

  const handleConfirmModalAccept = async () => {
    if (typeof confirmModalConfig.onConfirm !== 'function') {
      closeConfirmModal()
      return
    }

    await confirmModalConfig.onConfirm()
  }

  const openEntryDetail = async (entry) => {
    setDetailUnits([])
    setDetailEntry(entry)
    setDetailLoading(true)
    setDetailModalOpen(true)

    try {
      const units = await listUnitsByEntradaRequest(entry.id_entrada, token)
      setDetailUnits(Array.isArray(units) ? units : [])
    } catch (error) {
      setEntriesError(error.message || 'No se pudieron obtener las unidades')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeEntryDetail = () => {
    setDetailModalOpen(false)
    setDetailUnits([])
    setDetailEntry(null)
  }

  const handleExistenciasFilterChange = (event) => {
    const { name, value } = event.target
    setExistenciasFilter((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const clearExistenciasFilter = () => {
    setExistenciasFilter({
      id_producto: '',
      id_proveedor: '',
      vencimiento_hasta: '',
      search: '',
    })
  }

  const entryDetailByGroup = entries.reduce((accumulator, entry) => {
    const groupKey = `${entry.id_producto || 'na'}-${entry.id_proveedor || 'na'}`
    const summary = entryUnitSummary[entry.id_entrada] || { count: 0, totalWeight: 0 }
    const previous = accumulator.get(groupKey) || { count: 0, totalWeight: 0, quantityTotal: 0 }

    accumulator.set(groupKey, {
      count: previous.count + summary.count,
      totalWeight: previous.totalWeight + summary.totalWeight,
      quantityTotal: previous.quantityTotal + (Number(entry.cantidad_disponible) || 0),
    })

    return accumulator
  }, new Map())

  const filteredExistencias = existencias.filter((existencia) => {
    const matchesProduct =
      !existenciasFilter.id_producto ||
      String(existencia.id_producto) === String(existenciasFilter.id_producto)

    const matchesProvider =
      !existenciasFilter.id_proveedor ||
      String(existencia.id_proveedor) === String(existenciasFilter.id_proveedor)

    const matchesVencimiento =
      !existenciasFilter.vencimiento_hasta ||
      (existencia.fecha_vencimiento && existencia.fecha_vencimiento <= existenciasFilter.vencimiento_hasta)

    const term = existenciasFilter.search.trim().toLowerCase()
    const matchesSearch =
      !term ||
      `${existencia.producto_nombre || ''} ${existencia.nombre_empresa || ''} ${existencia.id_existencia || ''}`
        .toLowerCase()
        .includes(term)

    return matchesProduct && matchesProvider && matchesVencimiento && matchesSearch
  })

  const existenciasMap = filteredExistencias.reduce((accumulator, existencia) => {
    const productId = existencia.id_producto
    const providerId = existencia.id_proveedor
    const groupKey = `${productId || 'na'}-${providerId || 'na'}`
    const previous = accumulator.get(groupKey)
    const cantidad = Number(existencia.cantidad_disponible || 0)
    const costoUnitario = Number(existencia.costo_unitario)
    const hasCostoUnitario = Number.isFinite(costoUnitario)
    const costoUnitarioPeso = hasCostoUnitario && cantidad > 0 ? costoUnitario * cantidad : 0
    const entrySummary = entryDetailByGroup.get(groupKey) || { count: 0, totalWeight: 0, quantityTotal: 0 }
    const detalleCantidad = entrySummary.count || 0
    const detallePeso = entrySummary.totalWeight || 0
    const detalleUnidades =
      `Cantidad indicada: ${formatQuantity(entrySummary.quantityTotal)} lbs` +
      (detalleCantidad > 0
        ? ` · ${detalleCantidad} unidad${detalleCantidad === 1 ? '' : 'es'} (${detallePeso.toFixed(3)} lbs)`
        : ' · Sin detalle')

    if (!previous) {
      accumulator.set(groupKey, {
        group_key: groupKey,
        id_producto: productId,
        producto_nombre: existencia.producto_nombre,
        id_proveedor: providerId,
        nombre_empresa: existencia.nombre_empresa,
        cantidad_disponible: cantidad,
        costo_unitario_total: costoUnitarioPeso,
        costo_unitario_cantidad: hasCostoUnitario && cantidad > 0 ? cantidad : 0,
        fecha_vencimiento: existencia.fecha_vencimiento,
        detalle_unidades_count: detalleCantidad,
        detalle_unidades_peso: detallePeso,
        detalle_cantidad_total: entrySummary.quantityTotal,
        detalle_unidades: detalleUnidades,
      })
      return accumulator
    }

    const previousDate = previous.fecha_vencimiento || ''
    const currentDate = existencia.fecha_vencimiento || ''

    accumulator.set(groupKey, {
      ...previous,
      cantidad_disponible: previous.cantidad_disponible + cantidad,
      costo_unitario_total: previous.costo_unitario_total + costoUnitarioPeso,
      costo_unitario_cantidad: previous.costo_unitario_cantidad + (hasCostoUnitario && cantidad > 0 ? cantidad : 0),
      fecha_vencimiento: currentDate > previousDate ? currentDate : previousDate,
      nombre_empresa: existencia.nombre_empresa || previous.nombre_empresa,
      detalle_unidades_count: previous.detalle_unidades_count || detalleCantidad,
      detalle_unidades_peso: previous.detalle_unidades_peso || detallePeso,
      detalle_cantidad_total: previous.detalle_cantidad_total || entrySummary.quantityTotal,
      detalle_unidades: previous.detalle_unidades || detalleUnidades,
    })

    return accumulator
  }, new Map())

  const existenciasPorProducto = Array.from(existenciasMap.values())
    .map((existencia) => {
      const costoPromedio =
        existencia.costo_unitario_cantidad > 0
          ? existencia.costo_unitario_total / existencia.costo_unitario_cantidad
          : null
      const detalleUnidades =
        `${
          existencia.detalle_unidades_count > 0
            ? `${existencia.detalle_unidades_count} unidad${existencia.detalle_unidades_count === 1 ? '' : 'es'} (${existencia.detalle_unidades_peso.toFixed(3)} lbs)`
            : ' Sin detalle '
        }`

      return {
        ...existencia,
        costo_unitario: costoPromedio,
        detalle_unidades: detalleUnidades,
      }
    })

  const handleDownloadEntriesPdf = () => {
    if (visibleEntries.length === 0) {
      setEntriesError('No hay entradas para exportar en PDF')
      setEntriesNotice('')
      return
    }

    setEntriesError('')
    setEntriesNotice('')
    setIsExportingPdf(true)

    try {
      const doc = new jsPDF({ orientation: 'landscape' })
      const generatedAt = new Date().toLocaleString('es-GT')

      doc.setFontSize(14)
      doc.text('Reporte de Entradas de Mercancia', 14, 15)
      doc.setFontSize(10)
      doc.text(`Generado: ${generatedAt}`, 14, 22)

      autoTable(doc, {
        startY: 28,
        head: [['Fecha', 'Proveedor', 'Producto', 'Cantidad', 'Estado', 'Peso total unidades', 'Costo unitario', 'Costo total', 'Vencimiento', 'Documento', 'Receptor']],
        body: visibleEntries.map((entry) => {
          const summary = entryUnitSummary[entry.id_entrada] || { count: 0, totalWeight: 0 }
          const expired = isExpiredDate(entry.fecha_vencimiento)

          return [
            formatDateTime(entry.fecha_recepcion),
            entry.nombre_empresa || `Proveedor #${entry.id_proveedor}`,
            entry.producto_nombre || `Producto #${entry.id_producto}`,
            entry.cantidad_disponible ?? '-',
            expired ? 'Vencido' : 'Vigente',
            summary.count > 0 ? `${summary.totalWeight.toFixed(3)} kg` : '-',
            formatQuantity(entry.costo_unitario),
            formatQuantity(entry.costo_total),
            formatDateOnly(entry.fecha_vencimiento),
            entry.documento_referencia || '-',
            entry.receptor_nombre || '-',
          ]
        }),
        styles: {
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [31, 111, 59],
        },
      })

      const safeDate = new Date().toISOString().slice(0, 10)
      doc.save(`entradas_mercancia_${safeDate}.pdf`)
      setEntriesNotice('PDF descargado correctamente')
    } catch (error) {
      setEntriesError(error.message || 'No se pudo generar el PDF')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleDownloadEntryLabel = (entry) => {
    const lote = lotesByEntrada.get(String(entry.id_entrada))
    const code = buildTraceabilityCode({
      id_proveedor: entry.id_proveedor,
      id_entrada: entry.id_entrada,
      id_lote: lote?.id_lote_mp,
      id_producto: entry.id_producto,
    })

    downloadTraceabilityLabelPdf({
      code,
      title: 'Etiqueta de trazabilidad - Entrada',
      lines: [
        `Proveedor: ${entry.nombre_empresa || `#${entry.id_proveedor}`}`,
        `Producto: ${entry.producto_nombre || `#${entry.id_producto}`}`,
        `Entrada: #${entry.id_entrada}`,
        `Lote MP: ${lote ? `#${lote.id_lote_mp}` : 'N/A (insumo)'}`,
        `Fecha: ${formatDateTime(entry.fecha_recepcion)}`,
      ],
      fileName: `etiqueta_entrada_${entry.id_entrada}.pdf`,
    })
  }

  const handlePrintEntryDetail = (entry, entryUnits) => {
    const doc = new jsPDF()
    const generatedAt = new Date().toLocaleString('es-GT')

    doc.setFontSize(14)
    doc.text(`Detalle de entrada #${entry.id_entrada}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Generado: ${generatedAt}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [['Campo', 'Valor']],
      body: [
        ['Proveedor', entry.nombre_empresa || `Proveedor #${entry.id_proveedor}`],
        ['Producto', entry.producto_nombre || `Producto #${entry.id_producto}`],
        ['Fecha recepcion', formatDateTime(entry.fecha_recepcion)],
        ['Vencimiento', `${formatDateOnly(entry.fecha_vencimiento)} (${isExpiredDate(entry.fecha_vencimiento) ? 'Vencido' : 'Vigente'})`],
        ['Costo unitario', formatQuantity(entry.costo_unitario)],
        ['Costo total', formatQuantity(entry.costo_total)],
        ['Documento de referencia', entry.documento_referencia || '-'],
        ['Receptor', entry.receptor_nombre || '-'],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['#', 'Codigo unidad', 'Peso (kg)', 'Fecha pesaje']],
      body:
        entryUnits.length > 0
          ? entryUnits.map((unit, idx) => [
              idx + 1,
              unit.unidad_codigo || '-',
              Number(unit.peso).toFixed(3),
              unit.fecha_pesos ? new Date(unit.fecha_pesos).toLocaleString('es-GT') : '-',
            ])
          : [['-', '-', '-', '-']],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    doc.save(`entrada_${entry.id_entrada}_detalle.pdf`)
  }

  return (
    <section className="panel-card" aria-label="Modulo de entradas de mercancia">
      <div className="providers-header-row">
        <div>
          <h3>Entradas de mercancia</h3>
          <p>
            Registra cada recepcion de mercancia por proveedor. El receptor se asigna
            automaticamente al usuario autenticado: {userName}.
          </p>
        </div>
        <div className="provider-form-actions">
          <button type="button" onClick={openEntryModal}>
            Agregar
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadEntriesPdf}
            disabled={isEntriesLoading || isExportingPdf || visibleEntries.length === 0}
          >
            {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={loadInitialData}
            disabled={isEntriesLoading}
          >
            {isEntriesLoading ? 'Actualizando...' : 'Recargar'}
          </button>
        </div>
      </div>

      <div className="maturation-tab-strip" role="tablist" aria-label="Vista de entradas">
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

      {entryModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Nueva entrada de mercancia</h4>
                <p style={{ margin: 0 }}>Completa el formulario y agrega las unidades si aplica.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeEntryModal}>
                Cerrar
              </button>
            </div>

            <form className="provider-form" onSubmit={handleEntrySubmit}>
              <div className="provider-form-grid">
                <label>
                  Proveedor *
                  <select
                    name="id_proveedor"
                    value={entryForm.id_proveedor}
                    onChange={handleEntryFieldChange}
                    required
                  >
                    <option value="">Selecciona proveedor</option>
                    {providers.map((provider) => (
                      <option key={provider.id_proveedor} value={provider.id_proveedor}>
                        {provider.nombre_empresa || `Proveedor #${provider.id_proveedor}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Producto *
                  <select
                    name="id_producto"
                    value={entryForm.id_producto}
                    onChange={handleEntryFieldChange}
                    required
                  >
                    <option value="">Selecciona producto</option>
                    {entryProducts.map((product) => (
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
                    value={entryForm.fecha_vencimiento}
                    onChange={handleEntryFieldChange}
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
                    value={entryForm.costo_unitario}
                    onChange={handleEntryFieldChange}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Documento de referencia
                  <input
                    name="documento_referencia"
                    type="text"
                    value={entryForm.documento_referencia}
                    onChange={handleEntryFieldChange}
                    placeholder="Factura, remision o referencia"
                  />
                </label>

                <label>
                  Receptor
                  <input type="text" value={userName} disabled />
                </label>
              </div>

              <div style={{ width: '100%', marginTop: '8px' }}>
                <h4>Unidades pesadas *</h4>
                <p style={{ marginTop: 0, marginBottom: 8 }}>
                  Añade cada unidad con su peso individual. La cantidad de la entrada se calcula
                  automaticamente como la suma de los pesos registrados aqui.
                </p>

                <div style={{ marginBottom: 8 }}>
                  <button type="button" className="secondary-button" onClick={handleAddUnit}>
                    Añadir unidad
                  </button>
                </div>

                {units.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="providers-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Código unidad</th>
                          <th>Peso ({selectedEntryUnit})</th>
                          <th>Fecha pesaje</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {units.map((u, idx) => (
                          <tr key={`unit-${idx}`}>
                            <td>{idx + 1}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{u.unidad_codigo}</td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="provider-form-input"
                                value={u.peso}
                                onChange={(e) => handleUnitChange(idx, 'peso', e.target.value)}
                                placeholder="0.000"
                              />
                            </td>
                            <td>
                              <input
                                type="datetime-local"
                                className="provider-form-input date-input"
                                value={u.fecha_pesos || ''}
                                onChange={(e) => handleUnitChange(idx, 'fecha_pesos', e.target.value)}
                              />
                            </td>
                            <td>
                              <button type="button" className="danger-button" onClick={() => handleRemoveUnit(idx)}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <p style={{ marginTop: 8 }}>
                      <strong>Unidades:</strong> {units.length} — <strong>Peso total:</strong>{' '}
                      {unitsTotalWeight.toFixed(3)} {selectedEntryUnit}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isEntrySubmitting}>
                  {isEntrySubmitting ? 'Guardando...' : 'Registrar entrada'}
                </button>
                <button type="button" className="secondary-button" onClick={closeEntryModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: 'min(560px, 100%)' }}>
            <h4 style={{ marginTop: 0 }}>{confirmModalConfig.title}</h4>
            <p style={{ marginTop: 0 }}>{confirmModalConfig.message}</p>

            <div className="provider-form-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-button" onClick={closeConfirmModal}>
                {confirmModalConfig.cancelLabel}
              </button>
              <button type="button" className="danger-button" onClick={handleConfirmModalAccept}>
                {confirmModalConfig.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entriesError ? <p className="feedback error">{entriesError}</p> : null}
      {entriesNotice ? <p className="feedback success">{entriesNotice}</p> : null}

      {viewMode === 'consultar' ? (
        <div className="maturation-filter-panel">
          <div className="maturation-filter-grid">
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Buscar</span>
              <input
                type="text"
                value={consultaSearchTerm}
                onChange={(event) => setConsultaSearchTerm(event.target.value)}
                placeholder="Proveedor, producto, documento o receptor"
                className="maturation-filter-input"
              />
            </label>
          </div>
        </div>
      ) : (
        <p className="widget-muted" style={{ margin: '8px 0 0' }}>
          Mostrando unicamente entradas de materia prima aun no aceptadas en maduracion.
        </p>
      )}

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Estado</th>
              {viewMode === 'consultar' ? <th>Estado maduracion</th> : null}
              <th>Peso total unidades</th>
              <th>Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(viewMode === 'gestion' ? gestionEntries : consultaEntries).length === 0 && !isEntriesLoading ? (
              <tr>
                <td colSpan={viewMode === 'consultar' ? 9 : 8} className="empty-table-cell">
                  {viewMode === 'gestion'
                    ? 'No hay entradas pendientes de aceptar en maduracion.'
                    : 'No hay entradas registradas.'}
                </td>
              </tr>
            ) : null}

            {(viewMode === 'gestion' ? gestionEntries : consultaEntries).map((entry, index) => (
              (() => {
                const entryUnit = getProductUnitMeasure(entry.id_producto)
                const lote = lotesByEntrada.get(String(entry.id_entrada))
                const maturationStateLabel = lote
                  ? String(lote.estado_registro).trim().toLowerCase() === LOTE_PENDING_STATE
                    ? 'Pendiente de aceptar'
                    : 'Aceptado en maduracion'
                  : 'N/A (insumo)'

                return (
              <tr key={`${entry.id_entrada}-${entry.id_existencia || 'na'}-${index}`}>
                <td>{formatDateTime(entry.fecha_recepcion)}</td>
                <td>{entry.nombre_empresa || `Proveedor #${entry.id_proveedor}`}</td>
                <td>{entry.producto_nombre || `Producto #${entry.id_producto}`}</td>
                <td>
                  {(entryUnitSummary[entry.id_entrada]?.count || 0) > 0
                    ? `${entryUnitSummary[entry.id_entrada].count} unidades`
                    : `${entry.cantidad_disponible ?? '-'} lbs`}
                </td>
                <td>{isExpiredDate(entry.fecha_vencimiento) ? 'Vencido' : 'Vigente'}</td>
                {viewMode === 'consultar' ? <td>{maturationStateLabel}</td> : null}
                <td>
                  {(entryUnitSummary[entry.id_entrada]?.count || 0) > 0
                    ? `${(entryUnitSummary[entry.id_entrada]?.totalWeight || 0).toFixed(3)} ${entryUnit}`
                    : '-'}
                </td>
                <td>{formatDateOnly(entry.fecha_vencimiento)}</td>
                <td className="table-actions">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="secondary-button" onClick={() => openEntryDetail(entry)}>
                      Ver detalle
                    </button>
                    <button type="button" className="secondary-button" onClick={() => handleDownloadEntryLabel(entry)}>
                      Etiqueta
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleEntryDelete(entry.id_entrada)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
                )
              })()
            ))}
          </tbody>
        </table>
      </div>

      {detailModalOpen && detailEntry ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h4 style={{ margin: 0 }}>Detalle de entrada #{detailEntry.id_entrada}</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="secondary-button" onClick={() => handlePrintEntryDetail(detailEntry, detailUnits)}>
                  Imprimir detalle
                </button>
                <button type="button" className="secondary-button" onClick={closeEntryDetail}>Cerrar</button>
              </div>
            </div>

            <div className="providers-table-wrap table-limited" style={{ marginTop: 12 }}>
              <table className="providers-table">
                <tbody>
                  <tr>
                    <td>Proveedor</td>
                    <td>{detailEntry.nombre_empresa || `Proveedor #${detailEntry.id_proveedor}`}</td>
                  </tr>
                  <tr>
                    <td>Producto</td>
                    <td>{detailEntry.producto_nombre || `Producto #${detailEntry.id_producto}`}</td>
                  </tr>
                  <tr>
                    <td>Fecha recepcion</td>
                    <td>{formatDateTime(detailEntry.fecha_recepcion)}</td>
                  </tr>
                  <tr>
                    <td>Vencimiento</td>
                    <td>{formatDateOnly(detailEntry.fecha_vencimiento)} ({isExpiredDate(detailEntry.fecha_vencimiento) ? 'Vencido' : 'Vigente'})</td>
                  </tr>
                  <tr>
                    <td>Costo unitario</td>
                    <td>{formatQuantity(detailEntry.costo_unitario)}</td>
                  </tr>
                  <tr>
                    <td>Costo total</td>
                    <td>{formatQuantity(detailEntry.costo_total)}</td>
                  </tr>
                  <tr>
                    <td>Documento de referencia</td>
                    <td>{detailEntry.documento_referencia || '-'}</td>
                  </tr>
                  <tr>
                    <td>Receptor</td>
                    <td>{detailEntry.receptor_nombre || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Unidades</h4>

            {detailLoading ? (
              <p>Cargando unidades...</p>
            ) : (
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="providers-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Código unidad</th>
                      <th>Peso (kg)</th>
                      <th>Fecha pesaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailUnits.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="empty-table-cell">No hay unidades registradas.</td>
                      </tr>
                    ) : (
                      detailUnits.map((u, idx) => (
                        <tr key={`detail-${u.id}`}>
                          <td>{idx + 1}</td>
                          <td>{u.unidad_codigo || '-'}</td>
                          <td>{Number(u.peso).toFixed(3)}</td>
                          <td>{u.fecha_pesos ? new Date(u.fecha_pesos).toLocaleString('es-GT') : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {addUnitModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Añadir unidad</h4>
              <button type="button" className="secondary-button" onClick={() => setAddUnitModalOpen(false)}>Cerrar</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Peso (kg)
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="provider-form-input"
                  value={newUnit.peso}
                  onChange={(e) => handleNewUnitFieldChange('peso', e.target.value)}
                  placeholder="0.000"
                />
              </label>

              <label style={{ display: 'block', marginBottom: 8 }}>
                Fecha pesaje
                <input
                  type="datetime-local"
                  className="provider-form-input date-input"
                  value={newUnit.fecha_pesos}
                  onChange={(e) => handleNewUnitFieldChange('fecha_pesos', e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="secondary-button" onClick={handleAddUnitSubmit}>Añadir unidad</button>
                <button type="button" className="danger-button" onClick={() => setAddUnitModalOpen(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === 'consultar' ? (
      <>
      <div className="providers-header-row" style={{ marginTop: '18px' }}>
        <div>
          <h3>Existencias Totales</h3>
          <p>Resumen por producto y proveedor para diferenciar saldos del mismo producto entre proveedores.</p>
        </div>
      </div>

      <div className="provider-form" style={{ marginTop: '8px' }}>
        <div className="provider-form-grid">
          <label>
            Filtrar por producto
            <select
              name="id_producto"
              value={existenciasFilter.id_producto}
              onChange={handleExistenciasFilterChange}
            >
              <option value="">Todos</option>
                  {entryProducts.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.nombre || `Producto #${product.id_producto}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Filtrar por proveedor
            <select
              name="id_proveedor"
              value={existenciasFilter.id_proveedor}
              onChange={handleExistenciasFilterChange}
            >
              <option value="">Todos</option>
              {providers.map((provider) => (
                <option key={provider.id_proveedor} value={provider.id_proveedor}>
                  {provider.nombre_empresa || `Proveedor #${provider.id_proveedor}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vencimiento hasta
            <input
              name="vencimiento_hasta"
              type="date"
              value={existenciasFilter.vencimiento_hasta}
              onChange={handleExistenciasFilterChange}
            />
          </label>

          <label>
            Buscar
            <input
              name="search"
              type="text"
              value={existenciasFilter.search}
              onChange={handleExistenciasFilterChange}
              placeholder="Producto, proveedor o lote"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="button" className="secondary-button" onClick={clearExistenciasFilter}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Cantidad disponible</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {existenciasPorProducto.length === 0 && !isEntriesLoading ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No hay existencias para los filtros aplicados.
                </td>
              </tr>
            ) : null}

            {existenciasPorProducto.map((existencia) => (
              <tr key={existencia.group_key}>
                <td>{existencia.producto_nombre || `Producto #${existencia.id_producto}`}</td>
                <td>{existencia.nombre_empresa || `Proveedor #${existencia.id_proveedor}`}</td>
                <td>
                  {existencia.cantidad_disponible !== null && existencia.cantidad_disponible !== undefined
                    ? `${formatQuantity(existencia.cantidad_disponible)} lbs`
                    : '-'}
                </td>
                <td>{existencia.detalle_unidades || 'Sin detalle'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      ) : null}
    </section>
  )
}

export default EntriesModule