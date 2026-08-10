import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { listReadyForProductionRequest } from '../../services/maturation.service'
import { buildTraceabilityCode, downloadTraceabilityLabelPdf } from '../../utils/traceabilityLabel'
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
  listMermaTypesRequest,
  listProductionProcessesRequest,
  updateProductionStageRequest,
} from '../../services/production.service'

const FINISHED_PRODUCT_TYPE = 'Producto Terminado'
const INSUMO_PRODUCT_TYPE = 'Insumo'
const PRODUCTION_STAGES = ['Pelado', 'Corte', 'Fritura', 'Embalaje']
const PROCESS_ACTIVE_STATE = 'En proceso'
const PROCESS_PAUSED_STATE = 'Pausado'
const PROCESS_FINISHED_STATE = 'Finalizado'
const PROCESS_TABS = [
  { key: PROCESS_ACTIVE_STATE, label: 'En proceso' },
  { key: PROCESS_PAUSED_STATE, label: 'Pausados' },
  { key: PROCESS_FINISHED_STATE, label: 'Finalizados' },
]
const GESTION_PROCESS_STATES = new Set([PROCESS_ACTIVE_STATE, PROCESS_PAUSED_STATE])

const EMPTY_PROCESS_FORM = {
  id_sublote: '',
  id_producto_resultado: '',
  cantidad_ingresada_kg: '',
  fecha_inicio: '',
  cuarto_congelado: '',
  ubicacion_cuarto_congelado: '',
  observaciones: '',
}

const EMPTY_STAGE_FORM = {
  nombre_etapa: 'Pelado',
  cantidad_personas: '',
  personal_asignado: '',
  fecha_inicio: '',
  cantidad_entrada_kg: '',
  observaciones: '',
}

const EMPTY_STAGE_EDIT_FORM = {
  nombre_etapa: 'Pelado',
  cantidad_personas: '',
  personal_asignado: '',
  fecha_inicio: '',
  fecha_fin: '',
  cantidad_entrada_kg: '',
  cantidad_salida_kg: '',
  merma_kg: '',
  observaciones: '',
}

const EMPTY_MERMA_FORM = {
  id_tipo_merma: '',
  id_etapa: '',
  cantidad_kg: '',
  observaciones: '',
}

const EMPTY_INPUT_FORM = {
  id_producto: '',
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

const pad = (value) => String(value).padStart(2, '0')

const getNowDateTimeInputValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const toDateTimeInputValue = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const emptyToUndefined = (value) => (value === '' || value === null || value === undefined ? undefined : value)

function ProductionModule({ token, isActive }) {
  const [processes, setProcesses] = useState([])
  const [sublots, setSublots] = useState([])
  const [products, setProducts] = useState([])
  const [mermaTypes, setMermaTypes] = useState([])
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM)
  const [selectedTab, setSelectedTab] = useState(PROCESS_ACTIVE_STATE)
  const [viewMode, setViewMode] = useState('gestion')
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
  const [activeAction, setActiveAction] = useState(null)

  const [stageForm, setStageForm] = useState(EMPTY_STAGE_FORM)
  const [stageEditForm, setStageEditForm] = useState(EMPTY_STAGE_EDIT_FORM)
  const [editingStage, setEditingStage] = useState(null)
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
      const [processesData, sublotsData, productsData, mermaTypesData] = await Promise.all([
        listProductionProcessesRequest(token),
        listReadyForProductionRequest(token),
        listProductsRequest(token),
        listMermaTypesRequest(token),
      ])

      setProcesses(Array.isArray(processesData) ? processesData : [])
      setSublots(Array.isArray(sublotsData) ? sublotsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setMermaTypes(Array.isArray(mermaTypesData) ? mermaTypesData : [])
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

  const handleSublotSelect = (event) => {
    const { value } = event.target
    const sublot = sublots.find((item) => String(item.id_sublote) === String(value))

    setProcessForm((previous) => ({
      ...previous,
      id_sublote: value,
      cantidad_ingresada_kg: sublot ? String(sublot.peso_kg) : '',
    }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((previous) => ({ ...previous, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({ proceso: '', producto: '', mes: '' })
  }

  const availableSublots = sublots.filter((sublot) => Number(sublot.peso_kg) > 0)

  const finishedProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === FINISHED_PRODUCT_TYPE
  )

  const insumoProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === INSUMO_PRODUCT_TYPE
  )

  const selectedSublotForForm = sublots.find(
    (sublot) => String(sublot.id_sublote) === String(processForm.id_sublote)
  )

  const handleProcessSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingProcess(true)

    try {
      const payload = {
        id_sublote: Number(processForm.id_sublote),
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
    setActiveAction(null)
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
    setActiveAction(null)
  }

  const openAction = (action) => {
    setDetailError('')
    setDetailNotice('')

    if (action === 'stage') {
      setStageForm({ ...EMPTY_STAGE_FORM, fecha_inicio: getNowDateTimeInputValue() })
    } else if (action === 'merma') {
      setMermaForm(EMPTY_MERMA_FORM)
    } else if (action === 'insumo') {
      setInsumoForm(EMPTY_INPUT_FORM)
    } else if (action === 'coldRoom') {
      setColdRoomForm(EMPTY_COLD_ROOM_FORM)
    } else if (action === 'finalize') {
      setFinalizeForm(EMPTY_FINALIZE_FORM)
    }

    setActiveAction(action)
  }

  const closeAction = () => {
    if (isSubmittingDetail) {
      return
    }

    setActiveAction(null)
    setEditingStage(null)
  }

  const openStageEdit = (stage, { finalize = false } = {}) => {
    setDetailError('')
    setDetailNotice('')
    setEditingStage(stage)
    setStageEditForm({
      nombre_etapa: stage.nombre_etapa || 'Pelado',
      cantidad_personas: stage.cantidad_personas ?? '',
      personal_asignado: stage.personal_asignado || '',
      fecha_inicio: toDateTimeInputValue(stage.fecha_inicio),
      fecha_fin: finalize ? getNowDateTimeInputValue() : toDateTimeInputValue(stage.fecha_fin),
      cantidad_entrada_kg: stage.cantidad_entrada_kg ?? '',
      cantidad_salida_kg: stage.cantidad_salida_kg ?? '',
      merma_kg: stage.merma_kg ?? '',
      observaciones: stage.observaciones || '',
    })
    setActiveAction('stageEdit')
  }

  const openMermaForStage = (stage) => {
    setDetailError('')
    setDetailNotice('')
    setMermaForm({ ...EMPTY_MERMA_FORM, id_etapa: String(stage.id_etapa) })
    setActiveAction('merma')
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
        cantidad_personas: Number(stageForm.cantidad_personas),
        personal_asignado: emptyToUndefined(stageForm.personal_asignado.trim()),
        fecha_inicio: stageForm.fecha_inicio,
        cantidad_entrada_kg: emptyToUndefined(stageForm.cantidad_entrada_kg),
        observaciones: emptyToUndefined(stageForm.observaciones.trim()),
      }

      await addProductionStageRequest(selectedProcess.id_proceso, payload, token)
      setActiveAction(null)
      setDetailNotice('Etapa iniciada correctamente')
      setStageForm(EMPTY_STAGE_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo iniciar la etapa')
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const handleStageEditFieldChange = (event) => {
    const { name, value } = event.target
    setStageEditForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleStageEditSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setDetailNotice('')
    setIsSubmittingDetail(true)

    try {
      const payload = {
        nombre_etapa: stageEditForm.nombre_etapa,
        cantidad_personas: Number(stageEditForm.cantidad_personas),
        personal_asignado: emptyToUndefined(stageEditForm.personal_asignado.trim()),
        fecha_inicio: stageEditForm.fecha_inicio,
        fecha_fin: emptyToUndefined(stageEditForm.fecha_fin),
        cantidad_entrada_kg: emptyToUndefined(stageEditForm.cantidad_entrada_kg),
        cantidad_salida_kg: emptyToUndefined(stageEditForm.cantidad_salida_kg),
        merma_kg: emptyToUndefined(stageEditForm.merma_kg),
        observaciones: emptyToUndefined(stageEditForm.observaciones.trim()),
      }

      await updateProductionStageRequest(selectedProcess.id_proceso, editingStage.id_etapa, payload, token)
      setActiveAction(null)
      setEditingStage(null)
      setDetailNotice('Etapa actualizada correctamente')
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      setDetailError(error.message || 'No se pudo actualizar la etapa')
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
        id_tipo_merma: Number(mermaForm.id_tipo_merma),
        id_etapa: emptyToUndefined(mermaForm.id_etapa),
        cantidad_kg: Number(mermaForm.cantidad_kg),
        observaciones: emptyToUndefined(mermaForm.observaciones.trim()),
      }

      await addProductionMermaRequest(selectedProcess.id_proceso, payload, token)
      setActiveAction(null)
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
        id_producto: Number(insumoForm.id_producto),
        id_etapa: emptyToUndefined(insumoForm.id_etapa),
        cantidad: Number(insumoForm.cantidad),
        unidad_medida: insumoForm.unidad_medida.trim(),
        observaciones: emptyToUndefined(insumoForm.observaciones.trim()),
      }

      await addProductionInputRequest(selectedProcess.id_proceso, payload, token)
      setActiveAction(null)
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
      setActiveAction(null)
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
      setActiveAction(null)
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
      String(process.id_sublote || '').toLowerCase().includes(procesoTerm)

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

  const visibleProcessTabs =
    viewMode === 'gestion' ? PROCESS_TABS.filter((tab) => GESTION_PROCESS_STATES.has(tab.key)) : PROCESS_TABS

  const switchToGestionView = () => {
    setViewMode('gestion')
    setSelectedTab((current) => (GESTION_PROCESS_STATES.has(current) ? current : PROCESS_ACTIVE_STATE))
  }

  const isProcessFinished = selectedProcess?.estado_proceso === PROCESS_FINISHED_STATE

  const buildProcessFichaPdf = (detail) => {
    const doc = new jsPDF()
    const generatedAt = new Date().toLocaleString('es-GT')

    doc.setFontSize(14)
    doc.text(`Ficha de trazabilidad - Proceso #${detail.id_proceso}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Generado: ${generatedAt}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [['Campo', 'Valor']],
      body: [
        ['Sub-lote', `#${detail.id_sublote} (${detail.codigo_sublote || '-'})`],
        ['Producto resultado', detail.producto_resultado_nombre || `Producto #${detail.id_producto_resultado}`],
        ['Estado', detail.estado_proceso || '-'],
        ['Cantidad ingresada (kg)', formatNumber(detail.cantidad_ingresada_kg)],
        ['Cantidad producida (kg)', formatNumber(detail.cantidad_producida_kg)],
        ['Rendimiento', detail.rendimiento_porcentaje !== null && detail.rendimiento_porcentaje !== undefined ? `${formatNumber(detail.rendimiento_porcentaje)}%` : '-'],
        ['Merma total (kg)', formatNumber(detail.total_merma_kg)],
        ['Fecha inicio', detail.fecha_inicio ? new Date(detail.fecha_inicio).toLocaleString('es-GT') : '-'],
        ['Fecha fin', detail.fecha_fin ? new Date(detail.fecha_fin).toLocaleString('es-GT') : '-'],
        ['Cuarto congelado', detail.cuarto_congelado || '-'],
        ['Ubicacion cuarto congelado', detail.ubicacion_cuarto_congelado || '-'],
        ['Observaciones', detail.observaciones || '-'],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Etapa', 'Personas', 'Nombres', 'Entrada (kg)', 'Salida (kg)', 'Merma (kg)', 'Inicio', 'Fin']],
      body:
        (detail.etapas || []).length > 0
          ? detail.etapas.map((stage) => [
              stage.nombre_etapa,
              stage.cantidad_personas ?? '-',
              stage.personal_asignado || '-',
              formatNumber(stage.cantidad_entrada_kg),
              formatNumber(stage.cantidad_salida_kg),
              formatNumber(stage.merma_kg),
              stage.fecha_inicio ? new Date(stage.fecha_inicio).toLocaleString('es-GT') : '-',
              stage.fecha_fin ? new Date(stage.fecha_fin).toLocaleString('es-GT') : '-',
            ])
          : [['-', '-', '-', '-', '-', '-', '-', '-']],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Merma', 'Cantidad (kg)', 'Etapa', 'Fecha']],
      body:
        (detail.mermas || []).length > 0
          ? detail.mermas.map((merma) => [
              merma.nombre_merma,
              formatNumber(merma.cantidad_kg),
              merma.id_etapa ? `#${merma.id_etapa}` : '-',
              merma.fecha_registro ? new Date(merma.fecha_registro).toLocaleString('es-GT') : '-',
            ])
          : [['-', '-', '-', '-']],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Insumo', 'Cantidad', 'Unidad', 'Fecha']],
      body:
        (detail.insumos || []).length > 0
          ? detail.insumos.map((insumo) => [
              insumo.producto_nombre,
              formatNumber(insumo.cantidad),
              insumo.unidad_medida,
              insumo.fecha_registro ? new Date(insumo.fecha_registro).toLocaleString('es-GT') : '-',
            ])
          : [['-', '-', '-', '-']],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Cuarto frio - Ubicacion', 'Cantidad (kg)', 'Ingreso']],
      body:
        (detail.cuartos_frio || []).length > 0
          ? detail.cuartos_frio.map((entry) => [
              entry.ubicacion_cuarto,
              formatNumber(entry.cantidad_kg),
              entry.fecha_ingreso ? new Date(entry.fecha_ingreso).toLocaleString('es-GT') : '-',
            ])
          : [['-', '-', '-']],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 111, 59] },
    })

    doc.save(`proceso_${detail.id_proceso}_ficha.pdf`)
  }

  const handleDownloadProcessFicha = async (process) => {
    setModuleError('')

    try {
      const detail = Array.isArray(process.etapas) ? process : await getProductionProcessRequest(process.id_proceso, token)
      buildProcessFichaPdf(detail)
    } catch (error) {
      setModuleError(error.message || 'No se pudo generar la ficha del proceso')
    }
  }

  const handleDownloadProcessLabel = (process) => {
    const code = buildTraceabilityCode({
      id_proveedor: process.id_proveedor_origen,
      id_entrada: process.id_entrada_origen,
      id_lote: process.id_lote_mp,
      id_producto: process.id_producto_resultado,
    })

    downloadTraceabilityLabelPdf({
      code,
      title: 'Etiqueta de trazabilidad - Producto terminado',
      lines: [
        `Producto: ${process.producto_resultado_nombre || `#${process.id_producto_resultado}`}`,
        `Proceso: #${process.id_proceso}`,
        `Sub-lote: #${process.id_sublote} (${process.codigo_sublote || '-'})`,
        `Lote MP: ${process.id_lote_mp ? `#${process.id_lote_mp}` : 'N/A'}`,
        `Producido: ${formatNumber(process.cantidad_producida_kg)} kg`,
      ],
      fileName: `etiqueta_proceso_${process.id_proceso}.pdf`,
    })
  }

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

      <div className="maturation-tab-strip" role="tablist" aria-label="Vista de produccion">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'gestion'}
          className={`secondary-button maturation-tab-button ${viewMode === 'gestion' ? 'is-active' : ''}`}
          onClick={switchToGestionView}
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

      {viewMode === 'gestion' ? (
      <form className="provider-form" onSubmit={handleProcessSubmit}>
        <h4 style={{ marginTop: 0 }}>Iniciar proceso de produccion</h4>
        <div className="provider-form-grid">
          <label>
            Sub-lote listo para produccion *
            <select name="id_sublote" value={processForm.id_sublote} onChange={handleSublotSelect} required>
              <option value="">Selecciona sub-lote</option>
              {availableSublots.map((sublot) => (
                <option key={sublot.id_sublote} value={sublot.id_sublote}>
                  {`#${sublot.id_sublote} (${sublot.codigo_sublote}) - ${sublot.producto_nombre || `Producto ${sublot.id_producto}`} (disponible ${formatNumber(sublot.peso_kg)} kg)`}
                </option>
              ))}
            </select>
            {selectedSublotForForm ? (
              <small>Disponible: {formatNumber(selectedSublotForForm.peso_kg)} kg</small>
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
              placeholder="Selecciona un sub-lote"
              readOnly
              required
            />
            <small>Se toma del peso disponible del sub-lote (ya pesado en Maduracion). Para enviar menos, fracciona el sub-lote primero.</small>
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
      ) : null}

      <div className="maturation-tab-strip">
        {visibleProcessTabs.map((tab) => (
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
              <th>Sub-lote</th>
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
                <td>
                  #{process.id_sublote} ({process.codigo_sublote})
                </td>
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
                  <button type="button" className="secondary-button" onClick={() => handleDownloadProcessFicha(process)}>
                    PDF
                  </button>
                  {process.estado_proceso === PROCESS_FINISHED_STATE ? (
                    <button type="button" className="secondary-button" onClick={() => handleDownloadProcessLabel(process)}>
                      Etiqueta
                    </button>
                  ) : null}
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
                  Sub-lote #{selectedProcess.id_sublote} · {selectedProcess.producto_resultado_nombre || 'Producto sin nombre'} ·{' '}
                  {selectedProcess.estado_proceso}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="secondary-button" onClick={() => handleDownloadProcessFicha(selectedProcess)}>
                  Descargar ficha PDF
                </button>
                {selectedProcess.estado_proceso === PROCESS_FINISHED_STATE ? (
                  <button type="button" className="secondary-button" onClick={() => handleDownloadProcessLabel(selectedProcess)}>
                    Descargar etiqueta
                  </button>
                ) : null}
                <button type="button" className="secondary-button" onClick={closeDetail}>
                  Cerrar
                </button>
              </div>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}
            {detailNotice ? <p className="feedback success">{detailNotice}</p> : null}

            {!isProcessFinished ? (
              <div className="provider-form-actions" style={{ marginTop: '12px' }}>
                <button type="button" onClick={() => openAction('stage')}>
                  Agregar etapa
                </button>
                <button type="button" className="secondary-button" onClick={() => openAction('merma')}>
                  Agregar merma
                </button>
                <button type="button" className="secondary-button" onClick={() => openAction('insumo')}>
                  Agregar insumo
                </button>
                <button type="button" className="secondary-button" onClick={() => openAction('coldRoom')}>
                  Registrar cuarto frio
                </button>
                <button type="button" className="secondary-button" onClick={() => openAction('finalize')}>
                  Finalizar proceso
                </button>
              </div>
            ) : (
              <p style={{ marginTop: '12px' }}>
                Proceso finalizado el{' '}
                {selectedProcess.fecha_fin ? new Date(selectedProcess.fecha_fin).toLocaleString('es-GT') : '-'} con{' '}
                {formatNumber(selectedProcess.cantidad_producida_kg)} kg producidos (
                {formatNumber(selectedProcess.rendimiento_porcentaje)}% de rendimiento).
              </p>
            )}

            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Etapas</h4>
            <div className="providers-table-wrap table-limited">
              <table className="providers-table">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Personas</th>
                    <th>Nombres</th>
                    <th>Entrada (kg)</th>
                    <th>Salida (kg)</th>
                    <th>Merma (kg)</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProcess.etapas || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-table-cell">
                        Sin etapas registradas.
                      </td>
                    </tr>
                  ) : null}
                  {(selectedProcess.etapas || []).map((stage) => (
                    <tr key={stage.id_etapa}>
                      <td>{stage.nombre_etapa}</td>
                      <td>{stage.cantidad_personas ?? '-'}</td>
                      <td>{stage.personal_asignado || '-'}</td>
                      <td>{formatNumber(stage.cantidad_entrada_kg)}</td>
                      <td>{formatNumber(stage.cantidad_salida_kg)}</td>
                      <td>{formatNumber(stage.merma_kg)}</td>
                      <td>{stage.fecha_inicio ? new Date(stage.fecha_inicio).toLocaleString('es-GT') : '-'}</td>
                      <td>{stage.fecha_fin ? new Date(stage.fecha_fin).toLocaleString('es-GT') : '-'}</td>
                      <td className="table-actions">
                        {!isProcessFinished ? (
                          <>
                            {!stage.fecha_fin ? (
                              <button type="button" className="secondary-button" onClick={() => openStageEdit(stage, { finalize: true })}>
                                Finalizar
                              </button>
                            ) : null}
                            <button type="button" className="secondary-button" onClick={() => openStageEdit(stage)}>
                              Editar
                            </button>
                            <button type="button" className="secondary-button" onClick={() => openMermaForStage(stage)}>
                              Agregar merma
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                      <td>{merma.nombre_merma}</td>
                      <td>{formatNumber(merma.cantidad_kg)}</td>
                      <td>{merma.id_etapa ? `#${merma.id_etapa}` : '-'}</td>
                      <td>{merma.fecha_registro ? new Date(merma.fecha_registro).toLocaleString('es-GT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                      <td>{insumo.producto_nombre}</td>
                      <td>{formatNumber(insumo.cantidad)}</td>
                      <td>{insumo.unidad_medida}</td>
                      <td>{insumo.fecha_registro ? new Date(insumo.fecha_registro).toLocaleString('es-GT') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </div>
        </div>
      ) : null}

      {activeAction === 'stage' && selectedProcess ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Iniciar etapa · Proceso #{selectedProcess.id_proceso}</h4>
                <p style={{ margin: 0 }}>La hora de finalizacion se registra despues, al cerrar la etapa.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleStageSubmit} style={{ marginTop: '16px' }}>
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
                  Cantidad de personas *
                  <input
                    name="cantidad_personas"
                    type="number"
                    min="1"
                    step="1"
                    value={stageForm.cantidad_personas}
                    onChange={handleStageFieldChange}
                    placeholder="0"
                    required
                  />
                </label>

                <label>
                  Nombres (opcional)
                  <input
                    name="personal_asignado"
                    type="text"
                    value={stageForm.personal_asignado}
                    onChange={handleStageFieldChange}
                    placeholder="Ej. Juan, Maria"
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
                  {isSubmittingDetail ? 'Guardando...' : 'Iniciar etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeAction === 'stageEdit' && selectedProcess && editingStage ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>
                  {editingStage.fecha_fin ? 'Editar etapa' : 'Finalizar / editar etapa'} #{editingStage.id_etapa}
                </h4>
                <p style={{ margin: 0 }}>
                  Puedes volver a editar este registro despues si aun no tienes los datos de merma.
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleStageEditSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Etapa *
                  <select name="nombre_etapa" value={stageEditForm.nombre_etapa} onChange={handleStageEditFieldChange} required>
                    {PRODUCTION_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Cantidad de personas *
                  <input
                    name="cantidad_personas"
                    type="number"
                    min="1"
                    step="1"
                    value={stageEditForm.cantidad_personas}
                    onChange={handleStageEditFieldChange}
                    placeholder="0"
                    required
                  />
                </label>

                <label>
                  Nombres (opcional)
                  <input
                    name="personal_asignado"
                    type="text"
                    value={stageEditForm.personal_asignado}
                    onChange={handleStageEditFieldChange}
                    placeholder="Ej. Juan, Maria"
                  />
                </label>

                <label>
                  Fecha inicio *
                  <input
                    name="fecha_inicio"
                    type="datetime-local"
                    value={stageEditForm.fecha_inicio}
                    onChange={handleStageEditFieldChange}
                    required
                  />
                </label>

                <label>
                  Fecha fin
                  <input
                    name="fecha_fin"
                    type="datetime-local"
                    value={stageEditForm.fecha_fin}
                    onChange={handleStageEditFieldChange}
                  />
                </label>

                <label>
                  Entrada (kg)
                  <input
                    name="cantidad_entrada_kg"
                    type="number"
                    min="0"
                    step="0.01"
                    value={stageEditForm.cantidad_entrada_kg}
                    onChange={handleStageEditFieldChange}
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
                    value={stageEditForm.cantidad_salida_kg}
                    onChange={handleStageEditFieldChange}
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
                    value={stageEditForm.merma_kg}
                    onChange={handleStageEditFieldChange}
                    placeholder="0.00"
                  />
                  <small>Si aun no tienes el dato, deja vacio y vuelve a editar mas tarde.</small>
                </label>

                <label>
                  Observaciones
                  <input
                    name="observaciones"
                    type="text"
                    value={stageEditForm.observaciones}
                    onChange={handleStageEditFieldChange}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmittingDetail}>
                  {isSubmittingDetail ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeAction === 'merma' && selectedProcess ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Agregar merma · Proceso #{selectedProcess.id_proceso}</h4>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleMermaSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Categoria *
                  <select name="id_tipo_merma" value={mermaForm.id_tipo_merma} onChange={handleMermaFieldChange} required>
                    <option value="">Selecciona categoria</option>
                    {mermaTypes.map((mermaType) => (
                      <option key={mermaType.id_tipo_merma} value={mermaType.id_tipo_merma}>
                        {mermaType.nombre_merma}
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
          </div>
        </div>
      ) : null}

      {activeAction === 'insumo' && selectedProcess ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Agregar insumo · Proceso #{selectedProcess.id_proceso}</h4>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleInsumoSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Insumo *
                  <select name="id_producto" value={insumoForm.id_producto} onChange={handleInsumoFieldChange} required>
                    <option value="">Selecciona insumo</option>
                    {insumoProducts.map((product) => (
                      <option key={product.id_producto} value={product.id_producto}>
                        {product.nombre || `Producto #${product.id_producto}`}
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
          </div>
        </div>
      ) : null}

      {activeAction === 'coldRoom' && selectedProcess ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Registrar cuarto frio · Proceso #{selectedProcess.id_proceso}</h4>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleColdRoomSubmit} style={{ marginTop: '16px' }}>
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
          </div>
        </div>
      ) : null}

      {activeAction === 'finalize' && selectedProcess ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Finalizar proceso #{selectedProcess.id_proceso}</h4>
              </div>
              <button type="button" className="secondary-button" onClick={closeAction}>
                Cerrar
              </button>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}

            <form className="provider-form" onSubmit={handleFinalizeSubmit} style={{ marginTop: '16px' }}>
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
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ProductionModule
