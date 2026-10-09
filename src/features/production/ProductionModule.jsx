import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { listReadyForProductionRequest, listSublotsRequest } from '../../services/maturation.service'
import { downloadTraceabilityLabelPdf } from '../../utils/traceabilityLabel'
import { listProductsRequest } from '../../services/product.service'
import {
  addProductionColdRoomRequest,
  addProductionInputRequest,
  addProductionMermaRequest,
  addProductionStageRequest,
  cancelProductionOrderRequest,
  createMermaTypeRequest,
  createProductionOrderRequest,
  createProductionProcessRequest,
  createStageTypeRequest,
  finalizeProductionProcessRequest,
  getProductionProcessRequest,
  getProductStageRequirementsRequest,
  getProductividadReportRequest,
  listMermaTypesRequest,
  listProductionOrdersRequest,
  listProductionProcessesRequest,
  listStageTypesRequest,
  replaceProductStageRequirementsRequest,
  revertProductionProcessRequest,
  updateProductionStageRequest,
} from '../../services/production.service'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const FINISHED_PRODUCT_TYPE = 'Producto Terminado'
const INSUMO_PRODUCT_TYPE = 'Insumo'
const GREEN_RIPENESS_STATE = 'Verde'
const SUBLOT_ACTIVE_STATE = 'Activo'
const PRODUCTION_ORDER_PENDIENTE_STATE = 'Pendiente'
const PRODUCTION_ORDER_EN_PROCESO_STATE = 'En Proceso'
const PRODUCTION_ORDER_ACTIVE_STATES = new Set([PRODUCTION_ORDER_PENDIENTE_STATE, PRODUCTION_ORDER_EN_PROCESO_STATE])
const PROCESS_ACTIVE_STATE = 'En proceso'
const PROCESS_PAUSED_STATE = 'Pausado'
const PROCESS_FINISHED_STATE = 'Finalizado'
const PROCESS_TABS = [
  { key: PROCESS_ACTIVE_STATE, label: 'En proceso' },
  { key: PROCESS_PAUSED_STATE, label: 'Pausados' },
  { key: PROCESS_FINISHED_STATE, label: 'Finalizados' },
]
const GESTION_PROCESS_STATES = new Set([PROCESS_ACTIVE_STATE, PROCESS_PAUSED_STATE])

const PRODUCTIVITY_CHART_COLOR = '#2f7035'
const PRODUCTIVITY_GROUPINGS = [
  { key: 'mensual', label: 'Mensual' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'producto', label: 'Por producto' },
]

const EMPTY_PROCESS_FORM = {
  id_sublote: '',
  id_producto_resultado: '',
  id_orden: '',
  cantidad_ingresada_kg: '',
  fecha_inicio: '',
  cuarto_congelado: '',
  ubicacion_cuarto_congelado: '',
  observaciones: '',
}

const EMPTY_GREEN_PACK_FORM = {
  id_sublote: '',
  id_producto_resultado: '',
  id_tipo_etapa: '',
  cantidad_personas: '',
  fecha_inicio: '',
  observaciones: '',
}

const EMPTY_CAJA_ROW = { cantidad_redes: '', peso_kg: '' }

const EMPTY_CAJAS_QUICK_FILL = { numero_cajas: '', redes_por_caja: '', peso_por_caja: '' }

const EMPTY_STAGE_FORM = {
  id_tipo_etapa: '',
  cantidad_personas: '',
  personal_asignado: '',
  fecha_inicio: '',
  cantidad_entrada_kg: '',
  observaciones: '',
}

const EMPTY_STAGE_EDIT_FORM = {
  id_tipo_etapa: '',
  cantidad_personas: '',
  personal_asignado: '',
  fecha_inicio: '',
  fecha_fin: '',
  cantidad_entrada_kg: '',
  observaciones: '',
}

const EMPTY_STAGE_TYPE_FORM = {
  nombre_etapa: '',
  descripcion: '',
}

const EMPTY_PRODUCTION_ORDER_FORM = {
  id_producto: '',
  cantidad_solicitada_kg: '',
  fecha_solicitada: '',
  observaciones: '',
}

const EMPTY_MERMA_FORM = {
  id_tipo_merma: '',
  id_etapa: '',
  cantidad_kg: '',
  observaciones: '',
}

const EMPTY_MERMA_TYPE_FORM = {
  nombre_merma: '',
  descripcion: '',
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
  justificacion_diferencia: '',
}

const BALANCE_TOLERANCE_KG = 0.01

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

function ProductionModule({ token, isActive, roleName }) {
  const isAdmin = roleName === 'Administrador'

  const [processes, setProcesses] = useState([])
  const [sublots, setSublots] = useState([])
  const [products, setProducts] = useState([])
  const [mermaTypes, setMermaTypes] = useState([])
  const [stageTypes, setStageTypes] = useState([])
  const [productionOrders, setProductionOrders] = useState([])
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM)
  const [processFormOpen, setProcessFormOpen] = useState(false)

  // Empacar red: mismo mecanismo de produccion (crear proceso + registrar etapa), pero desde
  // un sub-lote Verde que aun no termino de madurar, en vez de uno "Listo para produccion".
  const [allSublots, setAllSublots] = useState([])
  const [greenPackForm, setGreenPackForm] = useState(EMPTY_GREEN_PACK_FORM)
  const [greenPackFormOpen, setGreenPackFormOpen] = useState(false)
  const [greenPackCajas, setGreenPackCajas] = useState([{ ...EMPTY_CAJA_ROW }])
  const [greenPackQuickFill, setGreenPackQuickFill] = useState(EMPTY_CAJAS_QUICK_FILL)
  const [greenPackStageOptions, setGreenPackStageOptions] = useState([])
  const [isLoadingGreenPackPlan, setIsLoadingGreenPackPlan] = useState(false)
  const [isSubmittingGreenPack, setIsSubmittingGreenPack] = useState(false)
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
  const [mermaTypeModalOpen, setMermaTypeModalOpen] = useState(false)
  const [mermaTypeForm, setMermaTypeForm] = useState(EMPTY_MERMA_TYPE_FORM)
  const [isSubmittingMermaType, setIsSubmittingMermaType] = useState(false)
  const [stageTypeModalOpen, setStageTypeModalOpen] = useState(false)
  const [stageTypeForm, setStageTypeForm] = useState(EMPTY_STAGE_TYPE_FORM)
  const [isSubmittingStageType, setIsSubmittingStageType] = useState(false)
  const [insumoForm, setInsumoForm] = useState(EMPTY_INPUT_FORM)
  const [coldRoomForm, setColdRoomForm] = useState(EMPTY_COLD_ROOM_FORM)
  const [finalizeForm, setFinalizeForm] = useState(EMPTY_FINALIZE_FORM)
  const [productionOrderForm, setProductionOrderForm] = useState(EMPTY_PRODUCTION_ORDER_FORM)
  const [productionOrderFormOpen, setProductionOrderFormOpen] = useState(false)
  const [isSubmittingProductionOrder, setIsSubmittingProductionOrder] = useState(false)

  const [productivityGrouping, setProductivityGrouping] = useState('mensual')
  const [productivityReport, setProductivityReport] = useState([])
  const [isLoadingProductivity, setIsLoadingProductivity] = useState(false)
  const [productivityError, setProductivityError] = useState('')
  const [hasLoadedProductivity, setHasLoadedProductivity] = useState(false)

  const [requirementsProductId, setRequirementsProductId] = useState('')
  const [requirementsDraft, setRequirementsDraft] = useState([])
  const [requirementsNewStageId, setRequirementsNewStageId] = useState('')
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false)
  const [isSavingRequirements, setIsSavingRequirements] = useState(false)
  const [requirementsError, setRequirementsError] = useState('')
  const [requirementsNotice, setRequirementsNotice] = useState('')
  const [detailRequiredStages, setDetailRequiredStages] = useState([])

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
      const [processesData, sublotsData, allSublotsData, productsData, mermaTypesData, stageTypesData, productionOrdersData] =
        await Promise.all([
          listProductionProcessesRequest(token),
          listReadyForProductionRequest(token),
          listSublotsRequest(token),
          listProductsRequest(token),
          listMermaTypesRequest(token),
          listStageTypesRequest(token),
          listProductionOrdersRequest(token),
        ])

      setProcesses(Array.isArray(processesData) ? processesData : [])
      setSublots(Array.isArray(sublotsData) ? sublotsData : [])
      setAllSublots(Array.isArray(allSublotsData) ? allSublotsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setMermaTypes(Array.isArray(mermaTypesData) ? mermaTypesData : [])
      setStageTypes(Array.isArray(stageTypesData) ? stageTypesData : [])
      setProductionOrders(Array.isArray(productionOrdersData) ? productionOrdersData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de produccion')
    } finally {
      setIsLoading(false)
    }
  }

  const loadProductivityReport = async (agrupacion) => {
    setProductivityError('')
    setIsLoadingProductivity(true)

    try {
      const rows = await getProductividadReportRequest(agrupacion, token)
      setProductivityReport(Array.isArray(rows) ? rows : [])
    } catch (error) {
      setProductivityError(error.message || 'No se pudo obtener el reporte de productividad')
    } finally {
      setIsLoadingProductivity(false)
      setHasLoadedProductivity(true)
    }
  }

  useEffect(() => {
    if (!isActive || viewMode !== 'productividad') {
      return
    }

    loadProductivityReport(productivityGrouping)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, viewMode, productivityGrouping, token])

  const productivityChartData = productivityReport.map((row) => ({
    etiqueta:
      productivityGrouping === 'producto'
        ? row.producto_nombre
        : `${row.periodo || '-'} · ${row.producto_nombre}`,
    producto: row.producto_nombre,
    periodo: row.periodo,
    kgPorHoraPersona: Number(row.kg_por_hora_persona) || 0,
  }))

  const handleProcessFieldChange = (event) => {
    const { name, value } = event.target
    setProcessForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'id_producto_resultado' ? { id_orden: '' } : {}),
    }))
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

  const greenAvailableSublots = allSublots.filter(
    (sublot) =>
      sublot.estado_maduracion === GREEN_RIPENESS_STATE &&
      sublot.estado_registro === SUBLOT_ACTIVE_STATE &&
      Number(sublot.peso_kg) > 0
  )

  const finishedProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === FINISHED_PRODUCT_TYPE
  )

  const insumoProducts = products.filter(
    (product) => String(product.tipo_producto || '').trim() === INSUMO_PRODUCT_TYPE
  )

  const selectedSublotForForm = sublots.find(
    (sublot) => String(sublot.id_sublote) === String(processForm.id_sublote)
  )

  const selectedGreenSublotForForm = greenAvailableSublots.find(
    (sublot) => String(sublot.id_sublote) === String(greenPackForm.id_sublote)
  )

  const validGreenPackCajas = greenPackCajas.filter((caja) => caja.cantidad_redes !== '' && caja.peso_kg !== '')
  const greenPackCajasTotalRedes = validGreenPackCajas.reduce((sum, caja) => sum + (Number(caja.cantidad_redes) || 0), 0)
  const greenPackCajasTotalPeso = validGreenPackCajas.reduce((sum, caja) => sum + (Number(caja.peso_kg) || 0), 0)

  // Si el producto elegido tiene un plan de etapas definido, solo se puede empacar con una
  // etapa de ese plan (igual que en "Agregar etapa" dentro de un proceso ya iniciado). Sin
  // plan definido (producto legado), se puede elegir cualquier etapa del catalogo.
  const greenPackStageTypeOptions = greenPackStageOptions.length > 0 ? greenPackStageOptions : stageTypes

  const matchingProductionOrders = productionOrders.filter(
    (order) =>
      PRODUCTION_ORDER_ACTIVE_STATES.has(order.estado) &&
      String(order.id_producto) === String(processForm.id_producto_resultado)
  )

  const requirementsDraftIds = new Set(requirementsDraft.map((item) => item.id_tipo_etapa))
  const availableStageTypesForRequirement = stageTypes.filter(
    (stageType) => !requirementsDraftIds.has(stageType.id_tipo_etapa)
  )

  // Si el producto del proceso tiene un plan de etapas definido, solo se puede registrar/editar
  // una etapa que forme parte de ese plan (no se permite "usar procesos diferentes" a los
  // planificados). Un producto sin plan (legado) no se restringe.
  const requiredStageTypeIds = new Set(detailRequiredStages.map((item) => item.id_tipo_etapa))
  const stageTypesForCurrentProcess =
    requiredStageTypeIds.size > 0
      ? stageTypes.filter((stageType) => requiredStageTypeIds.has(stageType.id_tipo_etapa))
      : stageTypes

  const handleProcessSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingProcess(true)

    try {
      const payload = {
        id_sublote: Number(processForm.id_sublote),
        id_producto_resultado: Number(processForm.id_producto_resultado),
        id_orden: emptyToUndefined(processForm.id_orden ? Number(processForm.id_orden) : ''),
        cantidad_ingresada_kg: Number(processForm.cantidad_ingresada_kg),
        fecha_inicio: emptyToUndefined(processForm.fecha_inicio),
        cuarto_congelado: emptyToUndefined(processForm.cuarto_congelado.trim()),
        ubicacion_cuarto_congelado: emptyToUndefined(processForm.ubicacion_cuarto_congelado.trim()),
        observaciones: emptyToUndefined(processForm.observaciones.trim()),
      }

      await createProductionProcessRequest(payload, token)
      setModuleNotice('Proceso de produccion iniciado correctamente')
      notifySuccess('Proceso de produccion iniciado correctamente')
      setProcessForm(EMPTY_PROCESS_FORM)
      setProcessFormOpen(false)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo iniciar el proceso de produccion'
      setModuleError(message)
      notifyError(message)
    } finally {
      setIsSubmittingProcess(false)
    }
  }

  const openProcessForm = () => {
    setProcessForm(EMPTY_PROCESS_FORM)
    setModuleError('')
    setModuleNotice('')
    setProcessFormOpen(true)
  }

  const closeProcessForm = () => {
    setProcessForm(EMPTY_PROCESS_FORM)
    setModuleError('')
    setProcessFormOpen(false)
  }

  const openGreenPackForm = () => {
    setGreenPackForm(EMPTY_GREEN_PACK_FORM)
    setGreenPackCajas([{ ...EMPTY_CAJA_ROW }])
    setGreenPackQuickFill(EMPTY_CAJAS_QUICK_FILL)
    setGreenPackStageOptions([])
    setModuleError('')
    setModuleNotice('')
    setGreenPackFormOpen(true)
  }

  const closeGreenPackForm = () => {
    setGreenPackForm(EMPTY_GREEN_PACK_FORM)
    setGreenPackCajas([{ ...EMPTY_CAJA_ROW }])
    setGreenPackQuickFill(EMPTY_CAJAS_QUICK_FILL)
    setGreenPackStageOptions([])
    setModuleError('')
    setGreenPackFormOpen(false)
  }

  const handleGreenPackFieldChange = (event) => {
    const { name, value } = event.target
    setGreenPackForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleGreenPackProductChange = async (event) => {
    const { value } = event.target
    setGreenPackForm((previous) => ({ ...previous, id_producto_resultado: value, id_tipo_etapa: '' }))
    setGreenPackStageOptions([])

    if (!value) {
      return
    }

    setIsLoadingGreenPackPlan(true)

    try {
      const requirements = await getProductStageRequirementsRequest(Number(value), token)
      const allowedIds = new Set((Array.isArray(requirements) ? requirements : []).map((item) => item.id_tipo_etapa))
      setGreenPackStageOptions(stageTypes.filter((stageType) => allowedIds.has(stageType.id_tipo_etapa)))
    } catch (error) {
      // Si falla la carga del plan, se deja el catalogo completo como respaldo (mejor dejar
      // elegir de mas que bloquear por completo el formulario).
      setGreenPackStageOptions([])
    } finally {
      setIsLoadingGreenPackPlan(false)
    }
  }

  const handleGreenPackCajaFieldChange = (index, field, value) => {
    setGreenPackCajas((previous) => {
      const next = [...previous]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddGreenPackCajaRow = () => {
    setGreenPackCajas((previous) => [...previous, { ...EMPTY_CAJA_ROW }])
  }

  const handleRemoveGreenPackCajaRow = (index) => {
    setGreenPackCajas((previous) => (previous.length === 1 ? previous : previous.filter((_, i) => i !== index)))
  }

  const handleGreenPackQuickFillChange = (event) => {
    const { name, value } = event.target
    setGreenPackQuickFill((previous) => ({ ...previous, [name]: value }))
  }

  const handleGenerateGreenPackCajas = () => {
    const numeroCajas = Number.parseInt(greenPackQuickFill.numero_cajas, 10)
    const redesPorCaja = greenPackQuickFill.redes_por_caja
    const pesoPorCaja = greenPackQuickFill.peso_por_caja

    if (!Number.isFinite(numeroCajas) || numeroCajas <= 0) {
      setModuleError('Indica cuantas cajas quieres generar')
      return
    }

    const generated = Array.from({ length: numeroCajas }, () => ({
      cantidad_redes: redesPorCaja,
      peso_kg: pesoPorCaja,
    }))

    setGreenPackCajas((previous) => {
      const existingIsBlank = previous.length === 1 && !previous[0].cantidad_redes && !previous[0].peso_kg
      return existingIsBlank ? generated : [...previous, ...generated]
    })
    setGreenPackQuickFill(EMPTY_CAJAS_QUICK_FILL)
    setModuleError('')
  }

  const handleGreenPackSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')

    if (validGreenPackCajas.length === 0) {
      setModuleError('Añade al menos una caja con su cantidad de redes y peso')
      return
    }

    if (selectedGreenSublotForForm && greenPackCajasTotalPeso > Number(selectedGreenSublotForForm.peso_kg)) {
      setModuleError('El peso de las cajas supera el peso disponible del sub-lote')
      return
    }

    setIsSubmittingGreenPack(true)

    try {
      const process = await createProductionProcessRequest(
        {
          id_sublote: Number(greenPackForm.id_sublote),
          id_producto_resultado: Number(greenPackForm.id_producto_resultado),
          cantidad_ingresada_kg: greenPackCajasTotalPeso,
          fecha_inicio: emptyToUndefined(greenPackForm.fecha_inicio),
        },
        token
      )

      await addProductionStageRequest(
        process.id_proceso,
        {
          id_tipo_etapa: Number(greenPackForm.id_tipo_etapa),
          cantidad_personas: Number.parseInt(greenPackForm.cantidad_personas, 10),
          fecha_inicio: emptyToUndefined(greenPackForm.fecha_inicio) || getNowDateTimeInputValue(),
          cantidad_entrada_kg: greenPackCajasTotalPeso,
          observaciones: emptyToUndefined(greenPackForm.observaciones.trim()),
          cajas: validGreenPackCajas.map((caja) => ({
            cantidad_redes: Number(caja.cantidad_redes),
            peso_kg: Number(caja.peso_kg),
          })),
        },
        token
      )

      const successMessage = `Red empacada: ${validGreenPackCajas.length} caja${validGreenPackCajas.length === 1 ? '' : 's'} (${greenPackCajasTotalRedes} redes, ${formatNumber(greenPackCajasTotalPeso)} kg)`
      setModuleNotice(successMessage)
      notifySuccess(successMessage)
      closeGreenPackForm()
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo empacar la red'
      setModuleError(message)
      notifyError(message)
    } finally {
      setIsSubmittingGreenPack(false)
    }
  }

  const handleRevertProcess = async (process) => {
    const hasWork =
      (process.total_etapas || 0) > 0 ||
      Number(process.total_merma_kg || 0) > 0 ||
      (process.total_insumos || 0) > 0

    let pesoARevertir = null
    let justificacionReversion = null

    if (hasWork) {
      const inputKg = Number(process.cantidad_ingresada_kg) || 0
      const mermaKg = Number(process.total_merma_kg) || 0
      const suggested = (inputKg - mermaKg).toFixed(2)

      const pesoInput = window.prompt(
        `Este proceso ya tiene etapas, mermas o insumos registrados.\nDeclara el peso (kg) que se devolvera al sub-lote (sugerido: ingresado - mermas = ${suggested} kg).`,
        suggested
      )

      if (pesoInput === null) {
        return
      }

      pesoARevertir = Number(pesoInput)

      if (!Number.isFinite(pesoARevertir) || pesoARevertir < 0) {
        setModuleError('El peso a revertir no es valido')
        return
      }

      justificacionReversion = window.prompt(
        'Justifica por que se cancela este proceso (obligatorio), por ejemplo: "Se daño el equipo, no se continua con este lote".'
      )

      if (!justificacionReversion || !justificacionReversion.trim()) {
        setModuleError('Debes justificar la reversion cuando el proceso ya tiene trabajo registrado')
        return
      }
    } else {
      const confirmRevert = window.confirm(
        'El sub-lote volvera a Listo para produccion y este proceso se eliminara. Deseas continuar?'
      )

      if (!confirmRevert) {
        return
      }
    }

    setModuleError('')
    setModuleNotice('')

    try {
      await revertProductionProcessRequest(
        process.id_proceso,
        { peso_a_revertir: pesoARevertir, justificacion_reversion: justificacionReversion },
        token
      )
      setModuleNotice('Proceso revertido: el sub-lote vuelve a Listo para produccion')
      notifySuccess('Proceso revertido: el sub-lote vuelve a Listo para produccion')
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo revertir el proceso'
      setModuleError(message)
      notifyError(message)
    }
  }

  const openDetail = async (process) => {
    setDetailError('')
    setDetailNotice('')
    setActiveAction(null)
    setDetailModalOpen(true)
    setSelectedProcess(process)
    setDetailRequiredStages([])

    try {
      const [detail, requiredStages] = await Promise.all([
        getProductionProcessRequest(process.id_proceso, token),
        getProductStageRequirementsRequest(process.id_producto_resultado, token).catch(() => []),
      ])
      setSelectedProcess(detail)
      setDetailRequiredStages(Array.isArray(requiredStages) ? requiredStages : [])
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

  const getNextStageEntrada = () => {
    const etapas = selectedProcess?.etapas || []

    if (etapas.length === 0) {
      return selectedProcess?.cantidad_ingresada_kg ?? ''
    }

    const lastStage = etapas[etapas.length - 1]
    return lastStage.cantidad_salida_kg ?? ''
  }

  const openAction = (action) => {
    setDetailError('')
    setDetailNotice('')

    if (action === 'stage') {
      setStageForm({ ...EMPTY_STAGE_FORM, fecha_inicio: getNowDateTimeInputValue(), cantidad_entrada_kg: getNextStageEntrada() })
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
      id_tipo_etapa: stage.id_tipo_etapa ? String(stage.id_tipo_etapa) : '',
      cantidad_personas: stage.cantidad_personas ?? '',
      personal_asignado: stage.personal_asignado || '',
      fecha_inicio: toDateTimeInputValue(stage.fecha_inicio),
      fecha_fin: finalize ? getNowDateTimeInputValue() : toDateTimeInputValue(stage.fecha_fin),
      cantidad_entrada_kg: stage.cantidad_entrada_kg ?? '',
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

  const editingStageMermaTotal = editingStage
    ? (selectedProcess?.mermas || [])
        .filter((merma) => String(merma.id_etapa) === String(editingStage.id_etapa))
        .reduce((sum, merma) => sum + (Number(merma.cantidad_kg) || 0), 0)
    : 0

  const editingStageComputedSalida = Math.max(
    0,
    (Number(stageEditForm.cantidad_entrada_kg) || 0) - editingStageMermaTotal
  )

  const finalizeInputKg = Number(selectedProcess?.cantidad_ingresada_kg || 0)
  const finalizeTotalMermaKg = Number(selectedProcess?.total_merma_kg || 0)
  const finalizeExpectedOutputKg = Math.max(0, finalizeInputKg - finalizeTotalMermaKg)
  const finalizeOutputKg = Number(finalizeForm.cantidad_producida_kg || 0)
  const finalizeDifferenceKg = Number((finalizeExpectedOutputKg - finalizeOutputKg).toFixed(2))
  const finalizeNeedsJustification =
    finalizeForm.cantidad_producida_kg !== '' && Math.abs(finalizeDifferenceKg) > BALANCE_TOLERANCE_KG

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
        id_tipo_etapa: Number(stageForm.id_tipo_etapa),
        cantidad_personas: Number(stageForm.cantidad_personas),
        personal_asignado: emptyToUndefined(stageForm.personal_asignado.trim()),
        fecha_inicio: stageForm.fecha_inicio,
        cantidad_entrada_kg: emptyToUndefined(stageForm.cantidad_entrada_kg),
        observaciones: emptyToUndefined(stageForm.observaciones.trim()),
      }

      await addProductionStageRequest(selectedProcess.id_proceso, payload, token)
      setActiveAction(null)
      setDetailNotice('Etapa iniciada correctamente')
      notifySuccess('Etapa iniciada correctamente')
      setStageForm(EMPTY_STAGE_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo iniciar la etapa'
      setDetailError(message)
      notifyError(message)
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
        id_tipo_etapa: Number(stageEditForm.id_tipo_etapa),
        cantidad_personas: Number(stageEditForm.cantidad_personas),
        personal_asignado: emptyToUndefined(stageEditForm.personal_asignado.trim()),
        fecha_inicio: stageEditForm.fecha_inicio,
        fecha_fin: emptyToUndefined(stageEditForm.fecha_fin),
        cantidad_entrada_kg: emptyToUndefined(stageEditForm.cantidad_entrada_kg),
        observaciones: emptyToUndefined(stageEditForm.observaciones.trim()),
      }

      await updateProductionStageRequest(selectedProcess.id_proceso, editingStage.id_etapa, payload, token)
      setActiveAction(null)
      setEditingStage(null)
      setDetailNotice('Etapa actualizada correctamente')
      notifySuccess('Etapa actualizada correctamente')
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo actualizar la etapa'
      setDetailError(message)
      notifyError(message)
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
      notifySuccess('Merma registrada correctamente')
      setMermaForm(EMPTY_MERMA_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo registrar la merma'
      setDetailError(message)
      notifyError(message)
    } finally {
      setIsSubmittingDetail(false)
    }
  }

  const openMermaTypeModal = () => {
    setMermaTypeForm(EMPTY_MERMA_TYPE_FORM)
    setDetailError('')
    setMermaTypeModalOpen(true)
  }

  const closeMermaTypeModal = () => {
    if (isSubmittingMermaType) {
      return
    }

    setMermaTypeModalOpen(false)
  }

  const handleMermaTypeFieldChange = (event) => {
    const { name, value } = event.target
    setMermaTypeForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleMermaTypeSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setIsSubmittingMermaType(true)

    try {
      const newMermaType = await createMermaTypeRequest(
        {
          nombre_merma: mermaTypeForm.nombre_merma.trim(),
          descripcion: emptyToUndefined(mermaTypeForm.descripcion.trim()),
        },
        token
      )

      const updatedTypes = await listMermaTypesRequest(token)
      setMermaTypes(Array.isArray(updatedTypes) ? updatedTypes : [])
      setMermaForm((previous) => ({ ...previous, id_tipo_merma: String(newMermaType.id_tipo_merma) }))
      setMermaTypeModalOpen(false)
      notifySuccess('Categoria de merma creada correctamente')
    } catch (error) {
      const message = error.message || 'No se pudo registrar la categoria de merma'
      setDetailError(message)
      notifyError(message)
    } finally {
      setIsSubmittingMermaType(false)
    }
  }

  const openStageTypeModal = () => {
    setStageTypeForm(EMPTY_STAGE_TYPE_FORM)
    setDetailError('')
    setStageTypeModalOpen(true)
  }

  const closeStageTypeModal = () => {
    if (isSubmittingStageType) {
      return
    }

    setStageTypeModalOpen(false)
  }

  const handleStageTypeFieldChange = (event) => {
    const { name, value } = event.target
    setStageTypeForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleStageTypeSubmit = async (event) => {
    event.preventDefault()
    setDetailError('')
    setIsSubmittingStageType(true)

    try {
      const newStageType = await createStageTypeRequest(
        {
          nombre_etapa: stageTypeForm.nombre_etapa.trim(),
          descripcion: emptyToUndefined(stageTypeForm.descripcion.trim()),
        },
        token
      )

      const updatedTypes = await listStageTypesRequest(token)
      setStageTypes(Array.isArray(updatedTypes) ? updatedTypes : [])

      // El "+" puede abrirse tanto al agregar una etapa nueva como al editar una existente;
      // se autoselecciona en el formulario que este activo en ese momento.
      if (activeAction === 'stageEdit') {
        setStageEditForm((previous) => ({ ...previous, id_tipo_etapa: String(newStageType.id_tipo_etapa) }))
      } else {
        setStageForm((previous) => ({ ...previous, id_tipo_etapa: String(newStageType.id_tipo_etapa) }))
      }

      setStageTypeModalOpen(false)
      notifySuccess('Tipo de etapa creado correctamente')
    } catch (error) {
      const message = error.message || 'No se pudo registrar el tipo de etapa'
      setDetailError(message)
      notifyError(message)
    } finally {
      setIsSubmittingStageType(false)
    }
  }

  const handleProductionOrderFieldChange = (event) => {
    const { name, value } = event.target
    setProductionOrderForm((previous) => ({ ...previous, [name]: value }))
  }

  const openProductionOrderForm = () => {
    setProductionOrderForm(EMPTY_PRODUCTION_ORDER_FORM)
    setModuleError('')
    setModuleNotice('')
    setProductionOrderFormOpen(true)
  }

  const closeProductionOrderForm = () => {
    setProductionOrderForm(EMPTY_PRODUCTION_ORDER_FORM)
    setModuleError('')
    setProductionOrderFormOpen(false)
  }

  const handleProductionOrderSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingProductionOrder(true)

    try {
      await createProductionOrderRequest(
        {
          id_producto: Number(productionOrderForm.id_producto),
          cantidad_solicitada_kg: Number(productionOrderForm.cantidad_solicitada_kg),
          fecha_solicitada: emptyToUndefined(productionOrderForm.fecha_solicitada),
          observaciones: emptyToUndefined(productionOrderForm.observaciones.trim()),
        },
        token
      )

      setModuleNotice('Orden de produccion creada correctamente')
      notifySuccess('Orden de produccion creada correctamente')
      setProductionOrderForm(EMPTY_PRODUCTION_ORDER_FORM)
      setProductionOrderFormOpen(false)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo crear la orden de produccion'
      setModuleError(message)
      notifyError(message)
    } finally {
      setIsSubmittingProductionOrder(false)
    }
  }

  const handleCancelProductionOrder = async (order) => {
    setModuleError('')
    setModuleNotice('')

    try {
      await cancelProductionOrderRequest(order.id_orden, token)
      setModuleNotice(`Orden de produccion #${order.id_orden} cancelada`)
      notifySuccess('Orden de produccion cancelada')
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo cancelar la orden de produccion'
      setModuleError(message)
      notifyError(message)
    }
  }

  const handleRequirementsProductChange = async (event) => {
    const { value } = event.target
    setRequirementsProductId(value)
    setRequirementsDraft([])
    setRequirementsNewStageId('')
    setRequirementsError('')
    setRequirementsNotice('')

    if (!value) {
      return
    }

    setIsLoadingRequirements(true)

    try {
      const requirements = await getProductStageRequirementsRequest(Number(value), token)
      setRequirementsDraft(Array.isArray(requirements) ? requirements : [])
    } catch (error) {
      setRequirementsError(error.message || 'No se pudo cargar la receta del producto')
    } finally {
      setIsLoadingRequirements(false)
    }
  }

  const handleAddRequirementStage = () => {
    if (!requirementsNewStageId) {
      return
    }

    const stageType = stageTypes.find((item) => String(item.id_tipo_etapa) === requirementsNewStageId)

    if (!stageType) {
      return
    }

    setRequirementsDraft((previous) => [
      ...previous,
      { id_tipo_etapa: stageType.id_tipo_etapa, nombre_etapa: stageType.nombre_etapa },
    ])
    setRequirementsNewStageId('')
  }

  const handleRemoveRequirementStage = (index) => {
    setRequirementsDraft((previous) => previous.filter((_, i) => i !== index))
  }

  const handleMoveRequirementStage = (index, direction) => {
    setRequirementsDraft((previous) => {
      const targetIndex = index + direction

      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous
      }

      const next = [...previous]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const handleSaveRequirements = async () => {
    if (!requirementsProductId) {
      return
    }

    setRequirementsError('')
    setRequirementsNotice('')
    setIsSavingRequirements(true)

    try {
      const etapas = requirementsDraft.map((item) => item.id_tipo_etapa)
      const saved = await replaceProductStageRequirementsRequest(Number(requirementsProductId), etapas, token)
      setRequirementsDraft(Array.isArray(saved) ? saved : [])
      setRequirementsNotice('Receta de etapas guardada correctamente')
      notifySuccess('Receta de etapas guardada correctamente')
    } catch (error) {
      const message = error.message || 'No se pudo guardar la receta de etapas'
      setRequirementsError(message)
      notifyError(message)
    } finally {
      setIsSavingRequirements(false)
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
      notifySuccess('Insumo registrado correctamente')
      setInsumoForm(EMPTY_INPUT_FORM)
      await refreshDetail(selectedProcess.id_proceso)
    } catch (error) {
      const message = error.message || 'No se pudo registrar el insumo'
      setDetailError(message)
      notifyError(message)
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
      notifySuccess('Ingreso a cuarto frio registrado correctamente')
      setColdRoomForm(EMPTY_COLD_ROOM_FORM)
      await refreshDetail(selectedProcess.id_proceso)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo registrar el ingreso a cuarto frio'
      setDetailError(message)
      notifyError(message)
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

    if (finalizeNeedsJustification && !finalizeForm.justificacion_diferencia.trim()) {
      setDetailError('El peso no cuadra: debes justificar la diferencia antes de finalizar.')
      return
    }

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
        justificacion_diferencia: emptyToUndefined(finalizeForm.justificacion_diferencia.trim()),
      }

      await finalizeProductionProcessRequest(selectedProcess.id_proceso, payload, token)
      setModuleNotice(`Proceso #${selectedProcess.id_proceso} finalizado correctamente`)
      notifySuccess(`Proceso #${selectedProcess.id_proceso} finalizado correctamente`)
      setActiveAction(null)
      setDetailModalOpen(false)
      setSelectedProcess(null)
      await loadInitialData()
    } catch (error) {
      const message = error.message || 'No se pudo finalizar el proceso'
      setDetailError(message)
      notifyError(message)
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
    downloadTraceabilityLabelPdf({
      code: process.codigo_lote || `Proceso #${process.id_proceso}`,
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
      <ReloadButton onClick={loadInitialData} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Produccion</h3>
          <p>Ingresa lotes listos de materia prima al piso productivo y registra su rendimiento.</p>
        </div>
      </div>

      {!detailModalOpen ? (
      <>
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
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'ordenes'}
          className={`secondary-button maturation-tab-button ${viewMode === 'ordenes' ? 'is-active' : ''}`}
          onClick={() => setViewMode('ordenes')}
        >
          Ordenes de produccion
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'recetas'}
          className={`secondary-button maturation-tab-button ${viewMode === 'recetas' ? 'is-active' : ''}`}
          onClick={() => setViewMode('recetas')}
        >
          Etapas por producto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'productividad'}
          className={`secondary-button maturation-tab-button ${viewMode === 'productividad' ? 'is-active' : ''}`}
          onClick={() => setViewMode('productividad')}
        >
          Productividad
        </button>
      </div>

      {viewMode === 'gestion' && !processFormOpen && !greenPackFormOpen ? (
      <div className="providers-header-row">
        <div>
          <h4 style={{ marginTop: 0 }}>Procesos de produccion</h4>
          <p style={{ margin: 0 }}>Ingresa un sub-lote listo para produccion al piso productivo.</p>
        </div>
        <div className="detail-action-toolbar">
          <button type="button" className="primary-button" onClick={openProcessForm}>
            + Iniciar proceso
          </button>
          <button type="button" className="secondary-button" onClick={openGreenPackForm}>
            + Empacar red
          </button>
        </div>
      </div>
      ) : null}

      {viewMode === 'gestion' && processFormOpen ? (
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
            Orden de produccion (opcional)
            <select name="id_orden" value={processForm.id_orden} onChange={handleProcessFieldChange}>
              <option value="">Sin orden (produccion libre)</option>
              {matchingProductionOrders.map((order) => (
                <option key={order.id_orden} value={order.id_orden}>
                  {`#${order.id_orden} - ${formatNumber(order.cantidad_solicitada_kg)} kg solicitados (${order.estado})`}
                </option>
              ))}
            </select>
            {processForm.id_producto_resultado && matchingProductionOrders.length === 0 ? (
              <small>No hay ordenes pendientes para este producto.</small>
            ) : null}
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
          <button type="button" className="secondary-button" onClick={closeProcessForm} disabled={isSubmittingProcess}>
            Cancelar
          </button>
        </div>
      </form>
      ) : null}

      {viewMode === 'gestion' && greenPackFormOpen ? (
      <form className="provider-form" onSubmit={handleGreenPackSubmit}>
        <h4 style={{ marginTop: 0 }}>Empacar red</h4>
        <p className="widget-muted" style={{ marginTop: 0 }}>
          Empaca un sub-lote Verde (aun sin terminar de madurar) directo en cajas de red, como un proceso de produccion mas.
        </p>
        <div className="provider-form-grid">
          <label>
            Sub-lote verde disponible *
            <select name="id_sublote" value={greenPackForm.id_sublote} onChange={handleGreenPackFieldChange} required>
              <option value="">Selecciona sub-lote</option>
              {greenAvailableSublots.map((sublot) => (
                <option key={sublot.id_sublote} value={sublot.id_sublote}>
                  {`#${sublot.id_sublote} (${sublot.codigo_sublote}) - ${sublot.producto_nombre || `Producto ${sublot.id_producto}`} (disponible ${formatNumber(sublot.peso_kg)} kg)`}
                </option>
              ))}
            </select>
            {selectedGreenSublotForForm ? (
              <small>Disponible: {formatNumber(selectedGreenSublotForForm.peso_kg)} kg</small>
            ) : null}
          </label>

          <label>
            Producto resultado (red terminada) *
            <select
              name="id_producto_resultado"
              value={greenPackForm.id_producto_resultado}
              onChange={handleGreenPackProductChange}
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
            Etapa *
            <select
              name="id_tipo_etapa"
              value={greenPackForm.id_tipo_etapa}
              onChange={handleGreenPackFieldChange}
              required
              disabled={!greenPackForm.id_producto_resultado || isLoadingGreenPackPlan}
            >
              <option value="">Selecciona tipo de etapa</option>
              {greenPackStageTypeOptions.map((stageType) => (
                <option key={stageType.id_tipo_etapa} value={stageType.id_tipo_etapa}>
                  {stageType.nombre_etapa}
                </option>
              ))}
            </select>
            {isLoadingGreenPackPlan ? <small>Cargando plan del producto...</small> : null}
          </label>

          <label>
            Cantidad de personas *
            <input
              name="cantidad_personas"
              type="number"
              min="1"
              step="1"
              value={greenPackForm.cantidad_personas}
              onChange={handleGreenPackFieldChange}
              placeholder="Ej. 2"
              required
            />
          </label>

          <label>
            Fecha inicio
            <input
              name="fecha_inicio"
              type="datetime-local"
              value={greenPackForm.fecha_inicio}
              onChange={handleGreenPackFieldChange}
            />
          </label>

          <label>
            Observaciones
            <input
              name="observaciones"
              type="text"
              value={greenPackForm.observaciones}
              onChange={handleGreenPackFieldChange}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="maturation-section-divider" aria-hidden="true" />

        <h4>Cajas a registrar</h4>
        <p className="widget-muted" style={{ margin: '0 0 10px' }}>
          Cada caja es un registro (no cada red suelta): indica cuantas redes contiene y el peso total de la caja.
          Si vas a registrar varias cajas iguales, usa el generador rapido.
        </p>

        <div className="maturation-filter-panel">
          <div className="maturation-filter-grid">
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Cantidad de cajas</span>
              <input
                name="numero_cajas"
                type="number"
                min="1"
                step="1"
                value={greenPackQuickFill.numero_cajas}
                onChange={handleGreenPackQuickFillChange}
                placeholder="ej. 10"
                className="maturation-filter-input"
              />
            </label>
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Redes por caja</span>
              <input
                name="redes_por_caja"
                type="number"
                min="1"
                step="1"
                value={greenPackQuickFill.redes_por_caja}
                onChange={handleGreenPackQuickFillChange}
                placeholder="ej. 50"
                className="maturation-filter-input"
              />
            </label>
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Peso por caja (kg)</span>
              <input
                name="peso_por_caja"
                type="number"
                min="0"
                step="0.01"
                value={greenPackQuickFill.peso_por_caja}
                onChange={handleGreenPackQuickFillChange}
                placeholder="ej. 25.00"
                className="maturation-filter-input"
              />
            </label>
          </div>
          <div className="maturation-filter-actions">
            <button type="button" className="secondary-button" onClick={handleGenerateGreenPackCajas}>
              Generar cajas
            </button>
          </div>
        </div>

        <div className="providers-table-wrap table-limited">
          <table className="providers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Redes en la caja</th>
                <th>Peso de la caja (kg)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {greenPackCajas.map((caja, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={caja.cantidad_redes}
                      onChange={(event) => handleGreenPackCajaFieldChange(index, 'cantidad_redes', event.target.value)}
                      placeholder="0"
                      className="maturation-filter-input"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={caja.peso_kg}
                      onChange={(event) => handleGreenPackCajaFieldChange(index, 'peso_kg', event.target.value)}
                      placeholder="0.00"
                      className="maturation-filter-input"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleRemoveGreenPackCajaRow(index)}
                      disabled={greenPackCajas.length === 1}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="provider-form-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="secondary-button" onClick={handleAddGreenPackCajaRow}>
            + Agregar caja
          </button>
          <p style={{ margin: 0 }}>
            {validGreenPackCajas.length} caja{validGreenPackCajas.length === 1 ? '' : 's'} · {greenPackCajasTotalRedes} redes · {formatNumber(greenPackCajasTotalPeso)} kg
            {selectedGreenSublotForForm && greenPackCajasTotalPeso > Number(selectedGreenSublotForForm.peso_kg) ? (
              <span style={{ color: '#8f1b1b', fontWeight: 700 }}> - supera el disponible ({formatNumber(selectedGreenSublotForForm.peso_kg)} kg)</span>
            ) : null}
          </p>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isSubmittingGreenPack}>
            {isSubmittingGreenPack ? 'Guardando...' : `Empacar ${validGreenPackCajas.length || ''} caja${validGreenPackCajas.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="secondary-button" onClick={closeGreenPackForm} disabled={isSubmittingGreenPack}>
            Cancelar
          </button>
        </div>
      </form>
      ) : null}

      {viewMode === 'gestion' || viewMode === 'consultar' ? (
      <>
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
              <th>Orden</th>
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
                <td colSpan="12" className="empty-table-cell">
                  No hay procesos en esta pestaña.
                </td>
              </tr>
            ) : null}

            {filteredProcesses.map((process) => (
              <tr key={process.id_proceso}>
                <td>#{process.id_proceso}</td>
                <td>{process.id_orden ? `#${process.id_orden}` : '-'}</td>
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
                    <button type="button" className="danger-button" onClick={() => handleRevertProcess(process)}>
                      Revertir
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      ) : viewMode === 'ordenes' ? (
      <>
        {!productionOrderFormOpen ? (
        <div className="providers-header-row">
          <div>
            <h4 style={{ marginTop: 0 }}>Ordenes de produccion</h4>
            <p style={{ margin: 0 }}>Guias de cuanto producto terminado hay que producir.</p>
          </div>
          <button type="button" className="primary-button" onClick={openProductionOrderForm}>
            + Nueva orden
          </button>
        </div>
        ) : null}

        {productionOrderFormOpen ? (
        <form className="provider-form" onSubmit={handleProductionOrderSubmit}>
          <h4 style={{ marginTop: 0 }}>Nueva orden de produccion</h4>
          <div className="provider-form-grid">
            <label>
              Producto terminado *
              <select
                name="id_producto"
                value={productionOrderForm.id_producto}
                onChange={handleProductionOrderFieldChange}
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
              Cantidad solicitada (kg) *
              <input
                name="cantidad_solicitada_kg"
                type="number"
                min="0.01"
                step="0.01"
                value={productionOrderForm.cantidad_solicitada_kg}
                onChange={handleProductionOrderFieldChange}
                required
              />
            </label>

            <label>
              Fecha solicitada
              <input
                name="fecha_solicitada"
                type="date"
                value={productionOrderForm.fecha_solicitada}
                onChange={handleProductionOrderFieldChange}
              />
            </label>

            <label className="full-width-field">
              Observaciones
              <input
                name="observaciones"
                type="text"
                value={productionOrderForm.observaciones}
                onChange={handleProductionOrderFieldChange}
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="provider-form-actions">
            <button type="submit" disabled={isSubmittingProductionOrder}>
              {isSubmittingProductionOrder ? 'Guardando...' : 'Crear orden'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={closeProductionOrderForm}
              disabled={isSubmittingProductionOrder}
            >
              Cancelar
            </button>
          </div>
        </form>
        ) : null}

        {moduleError ? <p className="feedback error">{moduleError}</p> : null}
        {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

        <div className="providers-table-wrap table-limited" style={{ marginTop: '8px' }}>
          <table className="providers-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Producto</th>
                <th>Solicitado (kg)</th>
                <th>Producido (kg)</th>
                <th>Fecha solicitada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productionOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-table-cell">
                    No hay ordenes de produccion registradas.
                  </td>
                </tr>
              ) : null}
              {productionOrders.map((order) => (
                <tr key={order.id_orden}>
                  <td>#{order.id_orden}</td>
                  <td>{order.producto_nombre || `Producto #${order.id_producto}`}</td>
                  <td>{formatNumber(order.cantidad_solicitada_kg)}</td>
                  <td>{formatNumber(order.cantidad_producida_kg)}</td>
                  <td>{order.fecha_solicitada ? new Date(order.fecha_solicitada).toLocaleDateString('es-GT') : '-'}</td>
                  <td>{order.estado}</td>
                  <td className="table-actions">
                    {order.estado === PRODUCTION_ORDER_PENDIENTE_STATE ? (
                      <button type="button" className="danger-button" onClick={() => handleCancelProductionOrder(order)}>
                        Cancelar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
      ) : viewMode === 'recetas' ? (
      <>
        <div className="providers-header-row">
          <div>
            <h4 style={{ marginTop: 0 }}>Etapas requeridas por producto</h4>
            <p style={{ margin: 0 }}>
              Define que etapas debe cumplir cada producto terminado, y en que orden, antes de poder finalizarlo.
            </p>
          </div>
        </div>

        <div className="provider-form-grid" style={{ marginTop: 12 }}>
          <label>
            Producto terminado *
            <select value={requirementsProductId} onChange={handleRequirementsProductChange}>
              <option value="">Selecciona producto terminado</option>
              {finishedProducts.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.nombre || `Producto #${product.id_producto}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {requirementsError ? <p className="feedback error">{requirementsError}</p> : null}
        {requirementsNotice ? <p className="feedback success">{requirementsNotice}</p> : null}

        {requirementsProductId && isLoadingRequirements ? <p>Cargando receta...</p> : null}

        {requirementsProductId && !isLoadingRequirements ? (
          <>
            <div className="maturation-section-divider" aria-hidden="true" />

            <h4>Secuencia de etapas</h4>
            {requirementsDraft.length === 0 ? (
              <p className="widget-muted">Este producto aun no tiene etapas requeridas definidas.</p>
            ) : (
              <div className="providers-table-wrap table-limited">
                <table className="providers-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Etapa</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirementsDraft.map((item, index) => (
                      <tr key={`${item.id_tipo_etapa}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.nombre_etapa}</td>
                        <td className="table-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleMoveRequirementStage(index, -1)}
                            disabled={index === 0}
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleMoveRequirementStage(index, 1)}
                            disabled={index === requirementsDraft.length - 1}
                          >
                            Bajar
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleRemoveRequirementStage(index)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="provider-form-actions" style={{ marginTop: 12 }}>
              <select
                className="provider-form-input"
                aria-label="Etapa a agregar a la secuencia"
                value={requirementsNewStageId}
                onChange={(event) => setRequirementsNewStageId(event.target.value)}
              >
                <option value="">Selecciona una etapa para agregar</option>
                {availableStageTypesForRequirement.map((stageType) => (
                  <option key={stageType.id_tipo_etapa} value={stageType.id_tipo_etapa}>
                    {stageType.nombre_etapa}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button"
                onClick={handleAddRequirementStage}
                disabled={!requirementsNewStageId}
              >
                + Agregar a la secuencia
              </button>
            </div>

            <div className="provider-form-actions" style={{ marginTop: 12 }}>
              <button type="button" onClick={handleSaveRequirements} disabled={isSavingRequirements}>
                {isSavingRequirements ? 'Guardando...' : 'Guardar receta'}
              </button>
            </div>
          </>
        ) : null}
      </>
      ) : viewMode === 'productividad' ? (
      <>
        <div className="providers-header-row">
          <div>
            <h4 style={{ marginTop: 0 }}>Productividad por persona y turno</h4>
            <p style={{ margin: 0 }}>
              Kilogramos producidos por hora-persona en procesos finalizados, a partir de las personas y el
              tiempo registrados en cada etapa.
            </p>
          </div>
        </div>

        <div className="maturation-tab-strip" role="tablist" aria-label="Agrupacion del reporte de productividad" style={{ marginTop: 12 }}>
          {PRODUCTIVITY_GROUPINGS.map((grouping) => (
            <button
              key={grouping.key}
              type="button"
              role="tab"
              aria-selected={productivityGrouping === grouping.key}
              className={`secondary-button maturation-tab-button ${productivityGrouping === grouping.key ? 'is-active' : ''}`}
              onClick={() => setProductivityGrouping(grouping.key)}
            >
              {grouping.label}
            </button>
          ))}
        </div>

        {productivityError ? <p className="feedback error">{productivityError}</p> : null}

        {isLoadingProductivity ? (
          <p className="widget-muted">Cargando reporte de productividad...</p>
        ) : !hasLoadedProductivity || productivityReport.length === 0 ? (
          <p className="widget-muted">
            Aun no hay procesos finalizados con etapas cerradas (con personas y fecha de fin) para calcular
            productividad.
          </p>
        ) : (
          <>
            <div style={{ width: '100%', height: 300, marginTop: 12 }}>
              <ResponsiveContainer>
                <BarChart data={productivityChartData} margin={{ top: 22, right: 8, left: 0, bottom: 56 }}>
                  <CartesianGrid vertical={false} stroke="#d8e5d3" />
                  <XAxis
                    dataKey="etiqueta"
                    tick={{ fontSize: 11, fill: '#4b5f45' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#4b5f45' }} width={50} />
                  <Tooltip
                    formatter={(value) => [`${formatNumber(value)} kg/hora-persona`, 'Productividad']}
                    contentStyle={{ borderRadius: 8, borderColor: '#bdd9a8', fontSize: 12 }}
                    cursor={{ fill: '#f4f9ef' }}
                  />
                  <Bar dataKey="kgPorHoraPersona" fill={PRODUCTIVITY_CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36}>
                    <LabelList
                      dataKey="kgPorHoraPersona"
                      position="top"
                      formatter={formatNumber}
                      style={{ fontSize: 11, fill: PRODUCTIVITY_CHART_COLOR }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="providers-table-wrap table-limited" style={{ marginTop: 12 }}>
              <table className="providers-table">
                <thead>
                  <tr>
                    {productivityGrouping !== 'producto' ? <th>Periodo</th> : null}
                    <th>Producto</th>
                    <th>Procesos</th>
                    <th>Kg producidos</th>
                    <th>Horas-persona</th>
                    <th>Kg / hora-persona</th>
                  </tr>
                </thead>
                <tbody>
                  {productivityReport.map((row, index) => (
                    <tr key={`${row.periodo || 'total'}-${row.id_producto}-${index}`}>
                      {productivityGrouping !== 'producto' ? <td>{row.periodo || '-'}</td> : null}
                      <td>{row.producto_nombre}</td>
                      <td>{row.total_procesos}</td>
                      <td>{formatNumber(row.total_kg_producido)}</td>
                      <td>{formatNumber(row.total_horas_persona)}</td>
                      <td>{formatNumber(row.kg_por_hora_persona)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </>
      ) : null}
      </>
      ) : null}

      {detailModalOpen && selectedProcess ? (
        <div className="inline-detail-view">
            <button type="button" className="secondary-button" onClick={closeDetail} style={{ marginBottom: 12 }}>
              ‹ Volver a procesos
            </button>

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
              </div>
            </div>

            {detailError ? <p className="feedback error">{detailError}</p> : null}
            {detailNotice ? <p className="feedback success">{detailNotice}</p> : null}

            {!isProcessFinished ? (
              <div className="provider-form-actions detail-action-toolbar" style={{ marginTop: '12px' }}>
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

            {detailRequiredStages.length > 0 ? (
              <>
                <div className="maturation-section-divider" aria-hidden="true" />
                <h4>Etapas requeridas para este producto</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {detailRequiredStages.map((requirement) => {
                    const isDone = (selectedProcess.etapas || []).some(
                      (stage) => stage.id_tipo_etapa === requirement.id_tipo_etapa
                    )

                    return (
                      <li key={requirement.id_tipo_etapa}>
                        {isDone ? '✓' : '○'} {requirement.nombre_etapa}
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : null}

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
                      <td>
                        {stage.nombre_etapa}
                        {stage.cajas && stage.cajas.length > 0 ? (
                          <>
                            <br />
                            <small>
                              {stage.cajas.length} caja{stage.cajas.length === 1 ? '' : 's'} ·{' '}
                              {stage.cajas.reduce((sum, caja) => sum + (Number(caja.cantidad_redes) || 0), 0)} redes
                            </small>
                          </>
                        ) : null}
                      </td>
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
                  <select name="id_tipo_etapa" value={stageForm.id_tipo_etapa} onChange={handleStageFieldChange} required>
                    <option value="">Selecciona tipo de etapa</option>
                    {stageTypesForCurrentProcess.map((stageType) => (
                      <option key={stageType.id_tipo_etapa} value={stageType.id_tipo_etapa}>
                        {stageType.nombre_etapa}
                      </option>
                    ))}
                  </select>
                  {stageTypesForCurrentProcess.length === 0 ? (
                    <small>Aun no hay tipos de etapa disponibles{requiredStageTypeIds.size > 0 ? ' en el plan de este producto' : ''}.</small>
                  ) : null}
                  {requiredStageTypeIds.size > 0 ? null : !stageTypeModalOpen ? (
                    <button type="button" className="secondary-button" style={{ marginTop: 6 }} onClick={openStageTypeModal}>
                      + Nuevo tipo de etapa
                    </button>
                  ) : (
                    <div className="maturation-filter-panel" style={{ marginTop: 8 }}>
                      <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 600 }}>Nuevo tipo de etapa</p>
                      <div className="provider-form-grid">
                        <label>
                          Nombre *
                          <input
                            name="nombre_etapa"
                            type="text"
                            maxLength={60}
                            value={stageTypeForm.nombre_etapa}
                            onChange={handleStageTypeFieldChange}
                            placeholder="Ej. Coccion"
                            required
                          />
                        </label>
                        <label>
                          Descripcion
                          <input
                            name="descripcion"
                            type="text"
                            maxLength={150}
                            value={stageTypeForm.descripcion}
                            onChange={handleStageTypeFieldChange}
                            placeholder="Opcional"
                          />
                        </label>
                      </div>
                      <div className="provider-form-actions">
                        <button type="button" onClick={handleStageTypeSubmit} disabled={isSubmittingStageType}>
                          {isSubmittingStageType ? 'Guardando...' : 'Guardar tipo de etapa'}
                        </button>
                        <button type="button" className="secondary-button" onClick={closeStageTypeModal}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
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
                    disabled={!isAdmin}
                    required
                  />
                  {!isAdmin ? (
                    <small>Solo un Administrador puede modificar la hora de inicio.</small>
                  ) : null}
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
                    disabled={!isAdmin}
                  />
                  <small>
                    {isAdmin
                      ? 'Se toma de la salida de la etapa anterior (o de la entrada del proceso en la primera etapa). Puedes ajustarla.'
                      : 'Se toma automaticamente de la salida de la etapa anterior. Solo un Administrador puede ajustarla.'}
                  </small>
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
                  <select
                    name="id_tipo_etapa"
                    value={stageEditForm.id_tipo_etapa}
                    onChange={handleStageEditFieldChange}
                    required
                  >
                    <option value="">Selecciona tipo de etapa</option>
                    {stageTypesForCurrentProcess.map((stageType) => (
                      <option key={stageType.id_tipo_etapa} value={stageType.id_tipo_etapa}>
                        {stageType.nombre_etapa}
                      </option>
                    ))}
                  </select>
                  {stageTypesForCurrentProcess.length === 0 ? (
                    <small>Aun no hay tipos de etapa disponibles{requiredStageTypeIds.size > 0 ? ' en el plan de este producto' : ''}.</small>
                  ) : null}
                  {requiredStageTypeIds.size > 0 ? null : !stageTypeModalOpen ? (
                    <button type="button" className="secondary-button" style={{ marginTop: 6 }} onClick={openStageTypeModal}>
                      + Nuevo tipo de etapa
                    </button>
                  ) : (
                    <div className="maturation-filter-panel" style={{ marginTop: 8 }}>
                      <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 600 }}>Nuevo tipo de etapa</p>
                      <div className="provider-form-grid">
                        <label>
                          Nombre *
                          <input
                            name="nombre_etapa"
                            type="text"
                            maxLength={60}
                            value={stageTypeForm.nombre_etapa}
                            onChange={handleStageTypeFieldChange}
                            placeholder="Ej. Coccion"
                            required
                          />
                        </label>
                        <label>
                          Descripcion
                          <input
                            name="descripcion"
                            type="text"
                            maxLength={150}
                            value={stageTypeForm.descripcion}
                            onChange={handleStageTypeFieldChange}
                            placeholder="Opcional"
                          />
                        </label>
                      </div>
                      <div className="provider-form-actions">
                        <button type="button" onClick={handleStageTypeSubmit} disabled={isSubmittingStageType}>
                          {isSubmittingStageType ? 'Guardando...' : 'Guardar tipo de etapa'}
                        </button>
                        <button type="button" className="secondary-button" onClick={closeStageTypeModal}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
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
                    disabled={!isAdmin}
                    required
                  />
                  {!isAdmin ? (
                    <small>Solo un Administrador puede modificar la hora de inicio.</small>
                  ) : null}
                </label>

                <label>
                  Fecha fin
                  <input
                    name="fecha_fin"
                    type="datetime-local"
                    value={stageEditForm.fecha_fin}
                    onChange={handleStageEditFieldChange}
                    disabled={!isAdmin}
                  />
                  {!isAdmin ? (
                    <small>Solo un Administrador puede modificar la hora de finalizacion.</small>
                  ) : null}
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
                    disabled={!isAdmin}
                  />
                  {!isAdmin ? <small>Solo un Administrador puede ajustar la entrada.</small> : null}
                </label>

                <label>
                  Merma (kg)
                  <input type="number" value={editingStageMermaTotal} readOnly />
                  <small>Suma automatica de las mermas registradas para esta etapa.</small>
                </label>

                <label>
                  Salida (kg)
                  <input
                    type="number"
                    value={stageEditForm.cantidad_entrada_kg === '' ? '' : editingStageComputedSalida}
                    readOnly
                  />
                  <small>Entrada menos la merma registrada.</small>
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
                  {mermaTypes.length === 0 ? (
                    <small>Aun no hay categorias de merma registradas.</small>
                  ) : null}
                  {!mermaTypeModalOpen ? (
                    <button type="button" className="secondary-button" style={{ marginTop: 6 }} onClick={openMermaTypeModal}>
                      + Nueva categoria
                    </button>
                  ) : (
                    <div className="maturation-filter-panel" style={{ marginTop: 8 }}>
                      <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 600 }}>Nueva categoria de merma</p>
                      <div className="provider-form-grid">
                        <label>
                          Nombre *
                          <input
                            name="nombre_merma"
                            type="text"
                            maxLength={50}
                            value={mermaTypeForm.nombre_merma}
                            onChange={handleMermaTypeFieldChange}
                            placeholder="Ej. Merma por corte"
                            required
                          />
                        </label>
                        <label>
                          Descripcion
                          <input
                            name="descripcion"
                            type="text"
                            maxLength={150}
                            value={mermaTypeForm.descripcion}
                            onChange={handleMermaTypeFieldChange}
                            placeholder="Opcional"
                          />
                        </label>
                      </div>
                      <div className="provider-form-actions">
                        <button type="button" onClick={handleMermaTypeSubmit} disabled={isSubmittingMermaType}>
                          {isSubmittingMermaType ? 'Guardando...' : 'Guardar categoria'}
                        </button>
                        <button type="button" className="secondary-button" onClick={closeMermaTypeModal}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
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

            <div className="maturation-filter-panel">
              <p style={{ margin: 0 }}>
                Ingresado: {formatNumber(finalizeInputKg)} kg &minus; Mermas: {formatNumber(finalizeTotalMermaKg)} kg
                = Esperado: <strong>{formatNumber(finalizeExpectedOutputKg)} kg</strong>
              </p>
              {finalizeForm.cantidad_producida_kg !== '' ? (
                <p style={{ margin: '6px 0 0' }} className={finalizeNeedsJustification ? 'feedback error' : 'feedback success'}>
                  {finalizeNeedsJustification
                    ? `No cuadra: diferencia de ${formatNumber(Math.abs(finalizeDifferenceKg))} kg ${finalizeDifferenceKg > 0 ? 'sin explicar (falta peso)' : 'de mas (sobra peso)'}. Debes justificarla abajo.`
                    : 'El peso cuadra exactamente.'}
                </p>
              ) : null}
            </div>

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

                {finalizeNeedsJustification ? (
                  <label style={{ gridColumn: '1 / -1' }}>
                    Justificacion de la diferencia *
                    <input
                      name="justificacion_diferencia"
                      type="text"
                      value={finalizeForm.justificacion_diferencia}
                      onChange={handleFinalizeFieldChange}
                      placeholder="Ej. derrame durante el traslado, error de pesaje en cascara, etc."
                      required
                    />
                  </label>
                ) : null}
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
