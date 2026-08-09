import { useEffect, useState } from 'react'
import { listMaturationLotsRequest } from '../../services/maturation.service'
import { listProductsRequest } from '../../services/product.service'
import {
  addProductionColdRoomRequest,
  addProductionInputRequest,
  addProductionMermaRequest,
  addProductionStageRequest,
  createProductionProcessRequest,
  deleteProductionProcessRequest,
  finalizeProductionProcessRequest,
  getProductionProcessRequest,
  listProductionProcessesRequest,
} from '../../services/production.service'

const LOT_READY_STATE = 'Completo'
const FINISHED_PRODUCT_TYPE = 'Producto Terminado'
const PRODUCTION_STAGES = ['Pelado', 'Corte', 'Fritura', 'Embalaje']
const MERMA_CATEGORIES = ['Cascara', 'Punta', 'Cuaches', 'Coccion', 'Quemados', 'Otra']
const INPUT_TYPES = ['Aceite', 'Bolsas de empaque', 'Bolsas de basura', 'Otro']
const PROCESS_ACTIVE_STATE = 'En proceso'
const PROCESS_PAUSED_STATE = 'Pausado'
const PROCESS_FINISHED_STATE = 'Finalizado'
const PROCESS_TABS = [
  { key: PROCESS_ACTIVE_STATE, label: 'En proceso' },
  { key: PROCESS_PAUSED_STATE, label: 'Pausados' },
  { key: PROCESS_FINISHED_STATE, label: 'Finalizados' },
]

const EMPTY_PROCESS_FORM = {
  id_lote_mp: '',
  id_producto_resultado: '',
  cantidad_ingresada_kg: '',
  fecha_inicio: '',
  cuarto_congelado: '',
  ubicacion_cuarto_congelado: '',
  observaciones: '',
}

const EMPTY_STAGE_FORM = {
  nombre_etapa: 'Pelado',
  fecha_inicio: '',
  fecha_fin: '',
  personal_asignado: '',
  cantidad_entrada_kg: '',
  cantidad_salida_kg: '',
  merma_kg: '',
  observaciones: '',
}

const EMPTY_MERMA_FORM = {
  categoria_merma: 'Cascara',
  id_etapa: '',
  cantidad_kg: '',
  observaciones: '',
}

const EMPTY_INPUT_FORM = {
  tipo_insumo: 'Aceite',
  id_etapa: '',
  cantidad: '',
  unidad_medida: 'Unidad',
  observaciones: '',
}

const EMPTY_COLD_ROOM_FORM = {
  fecha_ingreso: '',
  ubicacion_cuarto: '',
  cantidad_kg: '',
  observaciones: '',
}

const EMPTY_FINALIZE_FORM = {
  cantidad_producida_kg: '',
  fecha_fin: '',
  fecha_vencimiento: '',
  cuarto_congelado: '',
  ubicacion_cuarto_congelado: '',
  costo_unitario: '',
  observaciones: '',
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

function ProductionModule({ token, isActive }) {
  const [processes, setProcesses] = useState([])
  const [lots, setLots] = useState([])
  const [products, setProducts] = useState([])
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM)
  const [selectedTab, setSelectedTab] = useState(PROCESS_ACTIVE_STATE)
  const [filters, setFilters] = useState({ proceso: '', producto: '', mes: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmittingProcess, setIsSubmittingProcess] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

  const [selectedProcess, setSelectedProcess] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailNotice, setDetailNotice] = useState('')
  const [isSubmittingDetail, setIsSubmittingDetail] = useState(false)

  const [stageForm, setStageForm] = useState(EMPTY_STAGE_FORM)
  const [mermaForm, setMermaForm] = useState(EMPTY_MERMA_FORM)
  const [insumoForm, setInsumoForm] = useState(EMPTY_INPUT_FORM)
  const [coldRoomForm, setColdRoomForm] = useState(EMPTY_COLD_ROOM_FORM)
  const [finalizeForm, setFinalizeForm] = useState(EMPTY_FINALIZE_FORM)

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
      const [processesData, lotsData, productsData] = await Promise.all([
        listProductionProcessesRequest(token),
        listMaturationLotsRequest(token),
        listProductsRequest(token),
      ])

      setProcesses(Array.isArray(processesData) ? processesData : [])
      setLots(Array.isArray(lotsData) ? lotsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de produccion')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessFieldChange = (event) => {
    const { name, value } = event.target
    setProcessForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({ proceso: '', producto: '', mes: '' })
  }

  const availableLots = lots.filter(
    (lot) => lot.estado_registro === LOT_READY_STATE && Number(lot.peso_disponible_kg) > 0
  )

  const finishedProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === FINISHED_PRODUCT_TYPE
  )

  const selectedLotForForm = lots.find((lot) => String(lot.id_lote_mp) === String(processForm.id_lote_mp))

  const handleProcessSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingProcess(true)

    try {
      const payload = {
        id_lote_mp: Number(processForm.id_lote_mp),
        id_producto_resultado: Number(processForm.id_producto_resultado),
        cantidad_ingresada_kg: Number(processForm.cantidad_ingresada_kg),
        fecha_inicio: emptyToUndefined(processForm.fecha_inicio),
        cuarto_congelado: emptyToUndefined(processForm.cuarto_congelado.trim()),
        ubicacion_cuarto_congelado: emptyToUndefined(processForm.ubicacion_cuarto_congelado.trim()),
        observaciones: emptyToUndefined(processForm.observaciones.trim()),
      }

      await createProductionProcessRequest(payload, token)
      setModuleNotice('Proceso de produccion iniciado correctamente')
      setProcessForm(EMPTY_PROCESS_FORM)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo iniciar el proceso de produccion')
    } finally {
      setIsSubmittingProcess(false)
    }
  }

  const handleDeleteProcess = async (processId) => {
    const confirmDelete = window.confirm('Esta accion eliminara el proceso de produccion seleccionado. Deseas continuar?')

    if (!confirmDelete) {
      return
    }

    setModuleError('')
    setModuleNotice('')

    try {
      await deleteProductionProcessRequest(processId, token)
      setModuleNotice('Proceso eliminado correctamente')
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo eliminar el proceso')
    }
  }

  const openDetail = async (process) => {
    setDetailError('')
    setDetailNotice('')
    setStageForm(EMPTY_STAGE_FORM)
    setMermaForm(EMPTY_MERMA_FORM)
    setInsumoForm(EMPTY_INPUT_FORM)
    setColdRoomForm(EMPTY_COLD_ROOM_FORM)
    setFinalizeForm(EMPTY_FINALIZE_FORM)
    setDetailModalOpen(true)
    setSelectedProcess(process)

    try {
      const detail = await getProductionProcessRequest(process.id_proceso, token)
      setSelectedProcess(detail)
    } catch (error) {
      setDetailError(error.message || 'No se pudo cargar el detalle del proceso')
    }
  }

  const refreshDetail = async (processId) => {
    const detail = await getProductionProcessRequest(processId, token)
    setSelectedProcess(detail)
  }

  const closeDetail = () => {
    if (isSubmittingDetail) {
      return
    }

    setDetailModalOpen(false)
    setSelectedProcess(null)
  }

  const handleStageFieldChange = (event) => {
    const { name, value } = event.target
    setStageForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleStageSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        nombre_etapa: stageForm.nombre_etapa,
        fecha_inicio: stageForm.fecha_inicio,
        fecha_fin: emptyToUndefined(stageForm.fecha_fin),
        personal_asignado: stageForm.personal_asignado.trim(),
        cantidad_entrada_kg: emptyToUndefined(stageForm.cantidad_entrada_kg),
        cantidad_salida_kg: emptyToUndefined(stageForm.cantidad_salida_kg),
        merma_kg: emptyToUndefined(stageForm.merma_kg),
        observaciones: emptyToUndefined(stageForm.observaciones.trim()),
      }

      await addProductionStageRequest(selectedProcess.id_proceso, payload, token)
      setDetailNotice('Etapa registrada correctamente')
      setStageForm(EMPTY_STAGE_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo registrar la etapa')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleMermaFieldChange = (event) => {
    const { name, value } = event.target
    setMermaForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleMermaSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        categoria_merma: mermaForm.categoria_merma,
        id_etapa: emptyToUndefined(mermaForm.id_etapa),
        cantidad_kg: Number(mermaForm.cantidad_kg),
        observaciones: emptyToUndefined(mermaForm.observaciones.trim()),
      }

      await addProductionMermaRequest(selectedProcess.id_proceso, payload, token)
      setDetailNotice('Merma registrada correctamente')
      setMermaForm(EMPTY_MERMA_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo registrar la merma')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleInsumoFieldChange = (event) => {
    const { name, value } = event.target
    setInsumoForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleInsumoSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        tipo_insumo: insumoForm.tipo_insumo,
        id_etapa: emptyToUndefined(insumoForm.id_etapa),
        cantidad: Number(insumoForm.cantidad),
        unidad_medida: insumoForm.unidad_medida.trim(),
        observaciones: emptyToUndefined(insumoForm.observaciones.trim()),
      }

      await addProductionInputRequest(selectedProcess.id_proceso, payload, token)
      setDetailNotice('Insumo registrado correctamente')
      setInsumoForm(EMPTY_INPUT_FORM)
      await refreshDetail(selectedProcess.id_proceso)
    } catch (error) {
      setDetailError(error.message || 'No se pudo registrar el insumo')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleColdRoomFieldChange = (event) => {
    const { name, value } = event.target
    setColdRoomForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleColdRoomSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        fecha_ingreso: coldRoomForm.fecha_ingreso,
        ubicacion_cuarto: coldRoomForm.ubicacion_cuarto.trim(),
        cantidad_kg: Number(coldRoomForm.cantidad_kg),
        observaciones: emptyToUndefined(coldRoomForm.observaciones.trim()),
      }

      await addProductionColdRoomRequest(selectedProcess.id_proceso, payload, token)
      setDetailNotice('Ingreso a cuarto frio registrado correctamente')
      setColdRoomForm(EMPTY_COLD_ROOM_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo registrar el ingreso a cuarto frio')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleFinalizeFieldChange = (event) => {
    const { name, value } = event.target
    setFinalizeForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleFinalizeSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        cantidad_producida_kg: Number(finalizeForm.cantidad_producida_kg),
        fecha_fin: finalizeForm.fecha_fin,
        fecha_vencimiento: finalizeForm.fecha_vencimiento,
        cuarto_congelado: emptyToUndefined(finalizeForm.cuarto_congelado.trim()),
        ubicacion_cuarto_congelado: emptyToUndefined(finalizeForm.ubicacion_cuarto_congelado.trim()),
        observaciones: emptyToUndefined(finalizeForm.observaciones.trim()),
        costo_unitario: emptyToUndefined(finalizeForm.costo_unitario),
      }

      await finalizeProductionProcessRequest(selectedProcess.id_proceso, payload, token)
      setModuleNotice(`Proceso #${selectedProcess.id_proceso} finalizado correctamente`)
      setDetailModalOpen(false)
      setSelectedProcess(null)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo finalizar el proceso')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const processesInSelectedTab = processes.filter((process) => process.estado_proceso === selectedTab)

  const filteredProcesses = processesInSelectedTab.filter((process) => {
    const procesoTerm = filters.proceso.trim().toLowerCase()
    const productoTerm = filters.producto.trim().toLowerCase()
    const mesTerm = filters.mes.trim()

    const matchesProceso =
      !procesoTerm ||
      String(process.id_proceso || '').toLowerCase().includes(procesoTerm) ||
      String(process.id_lote_mp || '').toLowerCase().includes(procesoTerm)

    const matchesProducto =
      !productoTerm ||
      `${process.producto_resultado_nombre || ''} ${process.lote_producto_nombre || ''}`
        .toLowerCase()
        .includes(productoTerm)

    const matchesMes = !mesTerm || formatMonthInputValue(process.fecha_inicio) === mesTerm

    return matchesProceso && matchesProducto && matchesMes
  })

  const tabCounts = PROCESS_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = processes.filter((process) => process.estado_proceso === tab.key).length
    return accumulator
  }, {})

  const isProcessFinished = selectedProcess?.estado_proceso === PROCESS_FINISHED_STATE

  return (
    <section className="panel-card" aria-label="Modulo de produccion">
      <div className="providers-header-row">
        <div>
          <h3>Produccion</h3>
          <p>Ingresa lotes listos de materia prima al piso productivo y registra su rendimiento.</p>
        </div>
        <button type="button" className="secondary-button" onClick={loadInitialData} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Recargar'}
        </button>
      </div>

      <form className="provider-form" onSubmit={handleProcessSubmit}>
        <h4 style={{ marginTop: 0 }}>Iniciar proceso de produccion</h4>
        <div className="provider-form-grid">
          <label>
            Lote de materia prima *
            <select name="id_lote_mp" value={processForm.id_lote_mp} onChange={handleProcessFieldChange} required>
              <option value="">Selecciona lote</option>
              {availableLots.map((lot) => (
                <option key={lot.id_lote_mp} value={lot.id_lote_mp}>
                  {`#${lot.id_lote_mp} - ${lot.producto_nombre || `Producto ${lot.id_producto}`} (disponible ${formatNumber(lot.peso_disponible_kg)} kg)`}
                </option>
              ))}
            </select>
            {selectedLotForForm ? (
              <small>Disponible: {formatNumber(selectedLotForForm.peso_disponible_kg)} kg</small>
            ) : null}
          </label>

          <label>
            Producto resultado *
            <select
              name="id_producto_resultado"
              value={processForm.id_producto_resultado}
              onChange={handleProcessFieldChange}
              required
            >
              <option value="">Selecciona producto terminado</option>
              {finishedProducts.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.nombre || `Producto #${product.id_producto}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad ingresada (kg) *
            <input
              name="cantidad_ingresada_kg"
              type="number"
              min="0"
              step="0.01"
              value={processForm.cantidad_ingresada_kg}
              onChange={handleProcessFieldChange}
              placeholder="0.00"
              required
            />
          </label>

          <label>
            Fecha inicio
            <input
              name="fecha_inicio"
              type="datetime-local"
              value={processForm.fecha_inicio}
              onChange={handleProcessFieldChange}
            />
          </label>

          <label>
            Cuarto de congelado
            <input
              name="cuarto_congelado"
              type="text"
              value={processForm.cuarto_congelado}
              onChange={handleProcessFieldChange}
              placeholder="Opcional"
            />
          </label>

          <label>
            Ubicacion cuarto congelado
            <input
              name="ubicacion_cuarto_congelado"
              type="text"
              value={processForm.ubicacion_cuarto_congelado}
              onChange={handleProcessFieldChange}
              placeholder="Opcional"
            />
          </label>

          <label>
            Observaciones
            <input
              name="observaciones"
              type="text"
              value={processForm.observaciones}
              onChange={handleProcessFieldChange}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isSubmittingProcess}>
            {isSubmittingProcess ? 'Guardando...' : 'Iniciar proceso'}
          </button>
        </div>
      </form>

      <div className="maturation-tab-strip">
        {PROCESS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              selectedTab === tab.key
                ? 'secondary-button maturation-tab-button is-active'
                : 'secondary-button maturation-tab-button'
            }
            onClick={() => setSelectedTab(tab.key)}
          >
            {tab.label} ({tabCounts[tab.key] || 0})
          </button>
        ))}
      </div>

      <div className="maturation-filter-panel">
        <div className="maturation-filter-grid">
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Proceso / Lote</span>
            <input
              name="proceso"
              type="text"
              value={filters.proceso}
              onChange={handleFilterChange}
              placeholder="#proceso o #lote"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Producto</span>
            <input
              name="producto"
              type="text"
              value={filters.producto}
              onChange={handleFilterChange}
              placeholder="Producto"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Mes inicio</span>
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

      {moduleError ? <p className="feedback error">{moduleError}</p> : null}
      {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

      <div className="providers-table-wrap table-limited" style={{ marginTop: '8px' }}>
        <table className="providers-table">
          <thead>
            <tr>
              <th>Proceso</th>
              <th>Lote</th>
              <th>Producto resultado</th>
              <th>Ingresado (kg)</th>
              <th>Producido (kg)</th>
              <th>Rendimiento</th>
              <th>Etapas</th>
              <th>Merma total</th>
              <th>Estado</th>
              <th>Inicio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProcesses.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="11" className="empty-table-cell">
                  No hay procesos en esta pestaña.
                </td>
              </tr>
            ) : null}

            {filteredProcesses.map((process) => (
              <tr key={process.id_proceso}>
                <td>#{process.id_proceso}</td>
                <td>#{process.id_lote_mp}</td>
                <td>{process.producto_resultado_nombre || `Producto #${process.id_producto_resultado}`}</td>
                <td>{formatNumber(process.cantidad_ingresada_kg)}</td>
                <td>{formatNumber(process.cantidad_producida_kg)}</td>
                <td>{process.rendimiento_porcentaje !== null ? `${formatNumber(process.rendimiento_porcentaje)}%` : '-'}</td>
                <td>{process.total_etapas || 0} ({process.etapa_actual || '-'})</td>
                <td>{formatNumber(process.total_merma_kg)}</td>
                <td>{process.estado_proceso || '-'}</td>
                <td>{process.fecha_inicio ? new Date(process.fecha_inicio).toLocaleString('es-GT') : '-'}</td>
                <td className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => openDetail(process)}>
                    Gestionar
                  </button>
                  {process.estado_proceso !== PROCESS_FINISHED_STATE ? (
                    <button type="button" className="danger-button" onClick={() => handleDeleteProcess(process.id_proceso)}>
                      Eliminar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailModalOpen && selectedProcess ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Proceso #{selectedProcess.id_proceso}</h4>
                <p style={{ margin: 0 }}>
                  Lote #{selectedProcess.id_lote_mp} · {selectedProcess.producto_resultado_nombre || 'Producto sin nombre'} ·{' '}
                  {selectedProcess.estado_proceso}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeDetail}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}
            {detailNotice ? <p className="feedback success">{detailNotice}</p> : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Etapas</h4>
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Personal</th>
                    <th>Entrada (kg)</th>
                    <th>Salida (kg)</th>
                    <th>Merma (kg)</th>
                    <th>Inicio</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProcess.etapas || []).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-table-cell">
                        Sin etapas registradas.
                      </td>
                    </tr>
                  ) : null}
                  {(selectedProcess.etapas || []).map((stage) => (
                    <tr key={stage.id_etapa}>
                      <td>{stage.nombre_etapa}</td>
                      <td>{stage.personal_asignado}</td>
                      <td>{formatNumber(stage.cantidad_entrada_kg)}</td>
                      <td>{formatNumber(stage.cantidad_salida_kg)}</td>
                      <td>{formatNumber(stage.merma_kg)}</td>
                      <td>{stage.fecha_inicio ? new Date(stage.fecha_inicio).toLocaleString('es-GT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isProcessFinished ? (
              <form className="provider-form" onSubmit={handleStageSubmit}>
                <div className="provider-form-grid">
                  <label>
                    Etapa *
                    <select name="nombre_etapa" value={stageForm.nombre_etapa} onChange={handleStageFieldChange} required>
                      {PRODUCTION_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Personal asignado *
                    <input
                      name="personal_asignado"
                      type="text"
                      value={stageForm.personal_asignado}
                      onChange={handleStageFieldChange}
                      placeholder="Nombre del operario"
                      required
                    />
                  </label>

                  <label>
                    Fecha inicio *
                    <input
                      name="fecha_inicio"
                      type="datetime-local"
                      value={stageForm.fecha_inicio}
                      onChange={handleStageFieldChange}
                      required
                    />
                  </label>

                  <label>
                    Fecha fin
                    <input
                      name="fecha_fin"
                      type="datetime-local"
                      value={stageForm.fecha_fin}
                      onChange={handleStageFieldChange}
                    />
                  </label>

                  <label>
                    Entrada (kg)
                    <input
                      name="cantidad_entrada_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={stageForm.cantidad_entrada_kg}
                      onChange={handleStageFieldChange}
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Salida (kg)
                    <input
                      name="cantidad_salida_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={stageForm.cantidad_salida_kg}
                      onChange={handleStageFieldChange}
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Merma (kg)
                    <input
                      name="merma_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={stageForm.merma_kg}
                      onChange={handleStageFieldChange}
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Observaciones
                    <input
                      name="observaciones"
                      type="text"
                      value={stageForm.observaciones}
                      onChange={handleStageFieldChange}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="provider-form-actions">
                  <button type="submit" disabled={isSubmittingDetail}>
                    {isSubmittingDetail ? 'Guardando...' : 'Registrar etapa'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Mermas</h4>
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Cantidad (kg)</th>
                    <th>Etapa</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProcess.mermas || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-table-cell">
                        Sin mermas registradas.
                      </td>
                    </tr>
                  ) : null}
                  {(selectedProcess.mermas || []).map((merma) => (
                    <tr key={merma.id_merma}>
                      <td>{merma.categoria_merma}</td>
                      <td>{formatNumber(merma.cantidad_kg)}</td>
                      <td>{merma.id_etapa ? `#${merma.id_etapa}` : '-'}</td>
                      <td>{merma.fecha_registro ? new Date(merma.fecha_registro).toLocaleString('es-GT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isProcessFinished ? (
              <form className="provider-form" onSubmit={handleMermaSubmit}>
                <div className="provider-form-grid">
                  <label>
                    Categoria *
                    <select name="categoria_merma" value={mermaForm.categoria_merma} onChange={handleMermaFieldChange} required>
                      {MERMA_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Etapa
                    <select name="id_etapa" value={mermaForm.id_etapa} onChange={handleMermaFieldChange}>
                      <option value="">Sin etapa</option>
                      {(selectedProcess.etapas || []).map((stage) => (
                        <option key={stage.id_etapa} value={stage.id_etapa}>
                          {`#${stage.id_etapa} - ${stage.nombre_etapa}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Cantidad (kg) *
                    <input
                      name="cantidad_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={mermaForm.cantidad_kg}
                      onChange={handleMermaFieldChange}
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label>
                    Observaciones
                    <input
                      name="observaciones"
                      type="text"
                      value={mermaForm.observaciones}
                      onChange={handleMermaFieldChange}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="provider-form-actions">
                  <button type="submit" disabled={isSubmittingDetail}>
                    {isSubmittingDetail ? 'Guardando...' : 'Registrar merma'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Insumos</h4>
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProcess.insumos || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-table-cell">
                        Sin insumos registrados.
                      </td>
                    </tr>
                  ) : null}
                  {(selectedProcess.insumos || []).map((insumo) => (
                    <tr key={insumo.id_consumo}>
                      <td>{insumo.tipo_insumo}</td>
                      <td>{formatNumber(insumo.cantidad)}</td>
                      <td>{insumo.unidad_medida}</td>
                      <td>{insumo.fecha_registro ? new Date(insumo.fecha_registro).toLocaleString('es-GT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isProcessFinished ? (
              <form className="provider-form" onSubmit={handleInsumoSubmit}>
                <div className="provider-form-grid">
                  <label>
                    Tipo *
                    <select name="tipo_insumo" value={insumoForm.tipo_insumo} onChange={handleInsumoFieldChange} required>
                      {INPUT_TYPES.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Etapa
                    <select name="id_etapa" value={insumoForm.id_etapa} onChange={handleInsumoFieldChange}>
                      <option value="">Sin etapa</option>
                      {(selectedProcess.etapas || []).map((stage) => (
                        <option key={stage.id_etapa} value={stage.id_etapa}>
                          {`#${stage.id_etapa} - ${stage.nombre_etapa}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Cantidad *
                    <input
                      name="cantidad"
                      type="number"
                      min="0"
                      step="0.01"
                      value={insumoForm.cantidad}
                      onChange={handleInsumoFieldChange}
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label>
                    Unidad de medida *
                    <input
                      name="unidad_medida"
                      type="text"
                      value={insumoForm.unidad_medida}
                      onChange={handleInsumoFieldChange}
                      placeholder="Litros, unidades, etc."
                      required
                    />
                  </label>

                  <label>
                    Observaciones
                    <input
                      name="observaciones"
                      type="text"
                      value={insumoForm.observaciones}
                      onChange={handleInsumoFieldChange}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="provider-form-actions">
                  <button type="submit" disabled={isSubmittingDetail}>
                    {isSubmittingDetail ? 'Guardando...' : 'Registrar insumo'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Cuarto frio</h4>
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Ubicacion</th>
                    <th>Cantidad (kg)</th>
                    <th>Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProcess.cuartos_frio || []).length === 0 ? (
                    <tr>
                      <td colSpan="3" className="empty-table-cell">
                        Sin ingresos a cuarto frio.
                      </td>
                    </tr>
                  ) : null}
                  {(selectedProcess.cuartos_frio || []).map((entry) => (
                    <tr key={entry.id_ingreso_cuarto}>
                      <td>{entry.ubicacion_cuarto}</td>
                      <td>{formatNumber(entry.cantidad_kg)}</td>
                      <td>{entry.fecha_ingreso ? new Date(entry.fecha_ingreso).toLocaleString('es-GT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isProcessFinished ? (
              <form className="provider-form" onSubmit={handleColdRoomSubmit}>
                <div className="provider-form-grid">
                  <label>
                    Fecha ingreso *
                    <input
                      name="fecha_ingreso"
                      type="datetime-local"
                      value={coldRoomForm.fecha_ingreso}
                      onChange={handleColdRoomFieldChange}
                      required
                    />
                  </label>

                  <label>
                    Ubicacion cuarto *
                    <input
                      name="ubicacion_cuarto"
                      type="text"
                      value={coldRoomForm.ubicacion_cuarto}
                      onChange={handleColdRoomFieldChange}
                      placeholder="Cuarto frio 1"
                      required
                    />
                  </label>

                  <label>
                    Cantidad (kg) *
                    <input
                      name="cantidad_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={coldRoomForm.cantidad_kg}
                      onChange={handleColdRoomFieldChange}
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label>
                    Observaciones
                    <input
                      name="observaciones"
                      type="text"
                      value={coldRoomForm.observaciones}
                      onChange={handleColdRoomFieldChange}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="provider-form-actions">
                  <button type="submit" disabled={isSubmittingDetail}>
                    {isSubmittingDetail ? 'Guardando...' : 'Registrar ingreso'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="maturation-section-divider" aria-hidden="true" />

            {!isProcessFinished ? (
              <>
                <h4>Finalizar proceso</h4>
                <form className="provider-form" onSubmit={handleFinalizeSubmit}>
                  <div className="provider-form-grid">
                    <label>
                      Cantidad producida (kg) *
                      <input
                        name="cantidad_producida_kg"
                        type="number"
                        min="0"
                        step="0.01"
                        value={finalizeForm.cantidad_producida_kg}
                        onChange={handleFinalizeFieldChange}
                        placeholder="0.00"
                        required
                      />
                    </label>

                    <label>
                      Fecha fin *
                      <input
                        name="fecha_fin"
                        type="datetime-local"
                        value={finalizeForm.fecha_fin}
                        onChange={handleFinalizeFieldChange}
                        required
                      />
                    </label>

                    <label>
                      Fecha vencimiento *
                      <input
                        name="fecha_vencimiento"
                        type="date"
                        value={finalizeForm.fecha_vencimiento}
                        onChange={handleFinalizeFieldChange}
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
                        value={finalizeForm.costo_unitario}
                        onChange={handleFinalizeFieldChange}
                        placeholder="0.00"
                      />
                    </label>

                    <label>
                      Cuarto de congelado
                      <input
                        name="cuarto_congelado"
                        type="text"
                        value={finalizeForm.cuarto_congelado}
                        onChange={handleFinalizeFieldChange}
                        placeholder="Opcional"
                      />
                    </label>

                    <label>
                      Ubicacion cuarto congelado
                      <input
                        name="ubicacion_cuarto_congelado"
                        type="text"
                        value={finalizeForm.ubicacion_cuarto_congelado}
                        onChange={handleFinalizeFieldChange}
                        placeholder="Opcional"
                      />
                    </label>

                    <label>
                      Observaciones
                      <input
                        name="observaciones"
                        type="text"
                        value={finalizeForm.observaciones}
                        onChange={handleFinalizeFieldChange}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>

                  <div className="provider-form-actions">
                    <button type="submit" disabled={isSubmittingDetail}>
                      {isSubmittingDetail ? 'Guardando...' : 'Finalizar proceso'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p>
                Proceso finalizado el{' '}
                {selectedProcess.fecha_fin ? new Date(selectedProcess.fecha_fin).toLocaleString('es-GT') : '-'} con{' '}
                {formatNumber(selectedProcess.cantidad_producida_kg)} kg producidos (
                {formatNumber(selectedProcess.rendimiento_porcentaje)}% de rendimiento).
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ProductionModule
