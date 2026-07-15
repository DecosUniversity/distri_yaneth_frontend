import { useEffect, useState } from 'react'
import {
  listEntradasMercanciaRequest,
  listUnitsByEntradaRequest,
} from '../../services/entradas_mercancia.service'
import { listProductsRequest } from '../../services/product.service'
import { listProvidersRequest } from '../../services/provider.service'
import {
  createMaturationControlRequest,
  createMaturationLotRequest,
  deleteMaturationControlRequest,
  deleteMaturationLotRequest,
  listMaturationControlsRequest,
  listMaturationLotsRequest,
  updateMaturationLotRequest,
} from '../../services/maturation.service'

const MATURATION_STATES = ['Verde', 'Sarazo', 'Maduro', 'Sobre maduro', 'Listo para produccion']
const READY_FOR_PRODUCTION_STATE = 'Listo para produccion'
const PENDING_REGISTRATION_STATE = 'Pendiente'
const ACTIVE_REGISTRATION_STATE = 'Activo'
const COMPLETE_REGISTRATION_STATE = 'Completo'
const LOT_TABS = [
  { key: PENDING_REGISTRATION_STATE, label: 'Pendientes' },
  { key: ACTIVE_REGISTRATION_STATE, label: 'Activos' },
  { key: COMPLETE_REGISTRATION_STATE, label: 'Completos' },
]

const EMPTY_LOT_FORM = {
  id_producto: '',
  id_proveedor: '',
  id_entrada_origen: '',
  fecha_recepcion: '',
  cantidad_unidades: '',
  peso_inicial_kg: '',
  estado_maduracion: 'Verde',
  estado_registro: PENDING_REGISTRATION_STATE,
}

const EMPTY_CONTROL_FORM = {
  id_lote_mp: '',
  grados_brix: '',
  temperatura_cuarto: '',
  observaciones: '',
}

const normalizeLotPayload = (lotForm) => ({
  id_producto: Number(lotForm.id_producto),
  id_proveedor: Number(lotForm.id_proveedor),
  id_entrada_origen: Number(lotForm.id_entrada_origen),
  fecha_recepcion: lotForm.fecha_recepcion,
  cantidad_unidades: lotForm.cantidad_unidades === '' ? undefined : Number(lotForm.cantidad_unidades),
  peso_inicial_kg: Number(lotForm.peso_inicial_kg),
  estado_maduracion: lotForm.estado_maduracion,
  estado_registro: lotForm.estado_registro,
})

const normalizeControlPayload = (controlForm) => ({
  id_lote_mp: Number(controlForm.id_lote_mp),
  grados_brix: Number(controlForm.grados_brix),
  temperatura_cuarto:
    controlForm.temperatura_cuarto === '' ? undefined : Number(controlForm.temperatura_cuarto),
  observaciones: controlForm.observaciones.trim() || undefined,
})

const formatDateInputValue = (value) => {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 10)
}

const formatMonthInputValue = (value) => {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 7)
}

const getCurrentMonthKey = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

const getTodayDateInputValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function MaturationControlModule({ token, isActive }) {
  const [lots, setLots] = useState([])
  const [controls, setControls] = useState([])
  const [products, setProducts] = useState([])
  const [providers, setProviders] = useState([])
  const [entries, setEntries] = useState([])
  const [lotForm, setLotForm] = useState(EMPTY_LOT_FORM)
  const [controlForm, setControlForm] = useState(EMPTY_CONTROL_FORM)
  const [editingLotId, setEditingLotId] = useState(null)
  const [selectedLotTab, setSelectedLotTab] = useState(PENDING_REGISTRATION_STATE)
  const [lotFilters, setLotFilters] = useState({
    lote: '',
    producto: '',
    proveedor: '',
    mes_recepcion: '',
    estado_maduracion: '',
  })
  const [controlFilters, setControlFilters] = useState({
    mes_medicion: '',
    lote: '',
    producto: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmittingLot, setIsSubmittingLot] = useState(false)
  const [isSubmittingControl, setIsSubmittingControl] = useState(false)
  const [controlModalOpen, setControlModalOpen] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [moduleNotice, setModuleNotice] = useState('')

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
      const [lotsData, controlsData, productsData, providersData, entriesData] = await Promise.all([
        listMaturationLotsRequest(token),
        listMaturationControlsRequest(token),
        listProductsRequest(token),
        listProvidersRequest(token),
        listEntradasMercanciaRequest(token),
      ])

      setLots(Array.isArray(lotsData) ? lotsData : [])
      setControls(Array.isArray(controlsData) ? controlsData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setProviders(Array.isArray(providersData) ? providersData : [])
      setEntries(Array.isArray(entriesData) ? entriesData : [])
    } catch (error) {
      setModuleError(error.message || 'No se pudo cargar informacion de maduracion')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLotFieldChange = (event) => {
    const { name, value } = event.target

    if (editingLotId && name === 'id_producto') {
      return
    }

    setLotForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const updateLotWeightFromEntry = async (entryId) => {
    if (!entryId) {
      setLotForm((previous) => ({
        ...previous,
        peso_inicial_kg: '0',
      }))
      return
    }

    try {
      const unitsData = await listUnitsByEntradaRequest(entryId, token)
      const totalWeight = Array.isArray(unitsData)
        ? unitsData.reduce((sum, unit) => sum + (Number(unit.peso) || 0), 0)
        : 0

      setLotForm((previous) =>
        String(previous.id_entrada_origen) === String(entryId)
          ? {
              ...previous,
              peso_inicial_kg: totalWeight.toFixed(2),
            }
          : previous
      )
    } catch {
      setLotForm((previous) =>
        String(previous.id_entrada_origen) === String(entryId)
          ? {
              ...previous,
              peso_inicial_kg: '0',
            }
          : previous
      )
    }
  }

  const handleLotOriginChange = async (event) => {
    const { value } = event.target
    const selectedEntry = entries.find((entry) => String(entry.id_entrada) === String(value))

    setLotForm((previous) => ({
      ...previous,
      id_entrada_origen: value,
      id_producto: editingLotId ? previous.id_producto : selectedEntry ? String(selectedEntry.id_producto || previous.id_producto || '') : previous.id_producto,
      id_proveedor: editingLotId ? previous.id_proveedor : selectedEntry ? String(selectedEntry.id_proveedor || previous.id_proveedor || '') : previous.id_proveedor,
      fecha_recepcion: selectedEntry && selectedEntry.fecha_recepcion ? formatDateInputValue(selectedEntry.fecha_recepcion) : previous.fecha_recepcion,
      cantidad_unidades:
        selectedEntry && selectedEntry.cantidad_disponible !== undefined && selectedEntry.cantidad_disponible !== null
          ? String(selectedEntry.cantidad_disponible)
          : previous.cantidad_unidades,
      peso_inicial_kg: '0',
    }))

    await updateLotWeightFromEntry(value)
  }

  const handleControlFieldChange = (event) => {
    const { name, value } = event.target
    setControlForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleLotFilterChange = (event) => {
    const { name, value } = event.target
    setLotFilters((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const clearLotFilters = () => {
    setLotFilters({
      lote: '',
      producto: '',
      proveedor: '',
      mes_recepcion: '',
      estado_maduracion: '',
    })
  }

  const handleControlFilterChange = (event) => {
    const { name, value } = event.target
    setControlFilters((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const clearControlFilters = () => {
    setControlFilters({
      mes_medicion: '',
      lote: '',
      producto: '',
    })
  }

  const usedEntryOriginIds = new Set(
    lots
      .map((lot) => Number(lot.id_entrada_origen))
      .filter((entryId) => Number.isFinite(entryId) && entryId > 0)
  )

  const selectedLotMonthKey = lotFilters.mes_recepcion.trim()
  const currentMonthKey = getCurrentMonthKey()

  const pendingLots = lots.filter((lot) => lot.estado_registro === PENDING_REGISTRATION_STATE)
  const activeLots = lots.filter((lot) => lot.estado_registro === ACTIVE_REGISTRATION_STATE)
  const completedLots = lots.filter(
    (lot) =>
      lot.estado_registro === COMPLETE_REGISTRATION_STATE &&
      formatDateInputValue(lot.fecha_recepcion).startsWith(selectedLotMonthKey || currentMonthKey)
  )
  const lotsInSelectedTab =
    selectedLotTab === COMPLETE_REGISTRATION_STATE
      ? completedLots
      : lots.filter((lot) => lot.estado_registro === selectedLotTab)

  const filteredLots = lotsInSelectedTab.filter((lot) => {
    const lotTerm = lotFilters.lote.trim().toLowerCase()
    const productTerm = lotFilters.producto.trim().toLowerCase()
    const providerTerm = lotFilters.proveedor.trim().toLowerCase()
    const mesRecepcion = lotFilters.mes_recepcion.trim()
    const estadoMadura = lotFilters.estado_maduracion.trim()

    const matchesLot =
      !lotTerm ||
      String(lot.id_lote_mp || '').toLowerCase().includes(lotTerm) ||
      String(lot.id_entrada_origen || '').toLowerCase().includes(lotTerm)

    const matchesProduct =
      !productTerm ||
      `${lot.producto_nombre || ''} ${lot.id_producto || ''}`.toLowerCase().includes(productTerm)

    const matchesProvider =
      !providerTerm ||
      `${lot.proveedor_nombre || ''} ${lot.id_proveedor || ''}`.toLowerCase().includes(providerTerm)

    const matchesFecha =
      !mesRecepcion || formatMonthInputValue(lot.fecha_recepcion) === mesRecepcion

    const matchesEstado =
      !estadoMadura || String(lot.estado_maduracion || '') === estadoMadura

    return matchesLot && matchesProduct && matchesProvider && matchesFecha && matchesEstado
  })

  const lotIdsInSelectedTab = new Set(lotsInSelectedTab.map((lot) => Number(lot.id_lote_mp)))
  const lotMonthById = new Map(
    lots.map((lot) => [String(lot.id_lote_mp), formatMonthInputValue(lot.fecha_recepcion)])
  )
  const filteredControls = controls
    .filter((control) => lotIdsInSelectedTab.has(Number(control.id_lote_mp)))
    .filter((control) => {
      if (!selectedLotMonthKey) {
        return true
      }

      return lotMonthById.get(String(control.id_lote_mp)) === selectedLotMonthKey
    })
    .filter((control) => {
      const mesMedicion = controlFilters.mes_medicion.trim()
      const lotTerm = controlFilters.lote.trim().toLowerCase()
      const productTerm = controlFilters.producto.trim().toLowerCase()

      const matchesFecha =
        !mesMedicion || formatMonthInputValue(control.fecha_medicion) === mesMedicion

      const matchesLot =
        !lotTerm ||
        String(control.id_lote_mp || '').toLowerCase().includes(lotTerm) ||
        String(control.id_control || '').toLowerCase().includes(lotTerm)

      const matchesProduct =
        !productTerm ||
        `${control.producto_nombre || ''} ${control.id_producto || ''}`.toLowerCase().includes(productTerm)

      return matchesFecha && matchesLot && matchesProduct
    })

  const availableEntryOrigins = entries.filter((entry) => {
    const isActive = entry.estado_registro === 'Activo'

    if (editingLotId && String(lotForm.id_entrada_origen) === String(entry.id_entrada)) {
      return true
    }

    const entryId = Number(entry.id_entrada)
    const isUsed = usedEntryOriginIds.has(entryId)

    return isActive && Number.isFinite(entryId) && entryId > 0 && !isUsed
  })

  const handleAcceptPendingLot = async (lot) => {
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingLot(true)

    try {
      const payload = {
        id_producto: Number(lot.id_producto),
        id_proveedor: Number(lot.id_proveedor),
        id_entrada_origen: Number(lot.id_entrada_origen),
        fecha_recepcion: getTodayDateInputValue(),
        cantidad_unidades:
          lot.cantidad_unidades === null || lot.cantidad_unidades === undefined
            ? undefined
            : Number(lot.cantidad_unidades),
        peso_inicial_kg: Number(lot.peso_inicial_kg),
        estado_maduracion: lot.estado_maduracion || 'Verde',
        estado_registro: ACTIVE_REGISTRATION_STATE,
      }

      await updateMaturationLotRequest(lot.id_lote_mp, payload, token)
      setModuleNotice(`Lote #${lot.id_lote_mp} aceptado para maduracion`)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo aceptar la entrada para maduracion')
    } finally {
      setIsSubmittingLot(false)
    }
  }

  const handleLotSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingLot(true)

    try {
      const payload = normalizeLotPayload(lotForm)

      if (editingLotId) {
        await updateMaturationLotRequest(editingLotId, payload, token)
        setModuleNotice('Lote actualizado correctamente')
      } else {
        await createMaturationLotRequest(payload, token)
        setModuleNotice('Lote creado correctamente')
      }

      setLotForm(EMPTY_LOT_FORM)
      setEditingLotId(null)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo guardar lote')
    } finally {
      setIsSubmittingLot(false)
    }
  }

  const handleControlSubmit = async (event) => {
    event.preventDefault()
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingControl(true)

    try {
      const payload = normalizeControlPayload(controlForm)
      await createMaturationControlRequest(payload, token)
      setModuleNotice('Control de maduracion creado correctamente')
      setControlForm(EMPTY_CONTROL_FORM)
      setControlModalOpen(false)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo guardar control de maduracion')
    } finally {
      setIsSubmittingControl(false)
    }
  }

  const handleEditLot = (lot) => {
    setEditingLotId(lot.id_lote_mp)
    setLotForm({
      id_producto: String(lot.id_producto || ''),
      id_proveedor: String(lot.id_proveedor || ''),
      id_entrada_origen: lot.id_entrada_origen ? String(lot.id_entrada_origen) : '',
      fecha_recepcion: formatDateInputValue(lot.fecha_recepcion),
      cantidad_unidades:
        lot.cantidad_unidades === null || lot.cantidad_unidades === undefined
          ? ''
          : String(lot.cantidad_unidades),
      peso_inicial_kg:
        lot.peso_inicial_kg === null || lot.peso_inicial_kg === undefined
          ? ''
          : String(lot.peso_inicial_kg),
      estado_maduracion: lot.estado_maduracion || 'Verde',
      estado_registro: lot.estado_registro || PENDING_REGISTRATION_STATE,
    })
    setModuleNotice('')
    setModuleError('')
  }

  const cancelLotEdit = () => {
    setEditingLotId(null)
    setLotForm(EMPTY_LOT_FORM)
    setModuleNotice('')
  }

  const handleDeleteLot = async (lotId) => {
    const confirmDelete = window.confirm('Esta accion eliminara el lote y sus controles asociados. Deseas continuar?')

    if (!confirmDelete) {
      return
    }

    setModuleError('')
    setModuleNotice('')

    try {
      await deleteMaturationLotRequest(lotId, token)
      setModuleNotice('Lote eliminado correctamente')
      await loadInitialData()

      if (editingLotId === lotId) {
        cancelLotEdit()
      }
    } catch (error) {
      setModuleError(error.message || 'No se pudo eliminar lote')
    }
  }

  const handleDeleteControl = async (controlId) => {
    const confirmDelete = window.confirm('Esta accion eliminara el control seleccionado. Deseas continuar?')

    if (!confirmDelete) {
      return
    }

    setModuleError('')
    setModuleNotice('')

    try {
      await deleteMaturationControlRequest(controlId, token)
      setModuleNotice('Control eliminado correctamente')
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo eliminar control')
    }
  }

  const availableControlLots = activeLots

  const handleMarkReadyForProduction = async (lot) => {
    setModuleError('')
    setModuleNotice('')
    setIsSubmittingLot(true)

    try {
      const payload = {
        id_producto: Number(lot.id_producto),
        id_proveedor: Number(lot.id_proveedor),
        id_entrada_origen: Number(lot.id_entrada_origen),
        fecha_recepcion: formatDateInputValue(lot.fecha_recepcion),
        cantidad_unidades:
          lot.cantidad_unidades === null || lot.cantidad_unidades === undefined
            ? undefined
            : Number(lot.cantidad_unidades),
        peso_inicial_kg: Number(lot.peso_inicial_kg),
        estado_maduracion: READY_FOR_PRODUCTION_STATE,
        estado_registro: COMPLETE_REGISTRATION_STATE,
      }

      await updateMaturationLotRequest(lot.id_lote_mp, payload, token)
      setModuleNotice(`Lote #${lot.id_lote_mp} marcado como completo`)
      await loadInitialData()
    } catch (error) {
      setModuleError(error.message || 'No se pudo marcar el lote como listo para produccion')
    } finally {
      setIsSubmittingLot(false)
    }
  }

  const selectLotForControl = (lot) => {
    setControlForm((previous) => ({
      ...previous,
      id_lote_mp: String(lot.id_lote_mp),
    }))
    if (!lot.id_entrada_origen) {
      setModuleNotice(
        `Lote #${lot.id_lote_mp} seleccionado para control. Si no ves origen, revisa que la entrada esté guardada correctamente.`
      )
    } else {
      setModuleNotice(`Lote #${lot.id_lote_mp} seleccionado para control`)
    }
    setModuleError('')
    setControlModalOpen(true)
  }

  const closeControlModal = () => {
    if (isSubmittingControl) {
      return
    }

    setControlModalOpen(false)
  }

  return (
    <section className="panel-card" aria-label="Modulo de control de maduracion">
      <div className="providers-header-row">
        <div>
          <h3>Control de Maduracion</h3>
          <p>Gestiona lotes de materia prima y sus mediciones de grados brix.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={loadInitialData}
          disabled={isLoading}
        >
          {isLoading ? 'Actualizando...' : 'Recargar'}
        </button>
      </div>

      {editingLotId ? (
        <form className="provider-form" onSubmit={handleLotSubmit}>
          <h4 style={{ marginTop: 0 }}>Editar lote de materia prima</h4>
          <p style={{ marginTop: 0 }}>En edición solo puedes cambiar el estado de maduración.</p>
          <div className="provider-form-grid">
            <label>
              Entrada origen *
              <select name="id_entrada_origen" value={lotForm.id_entrada_origen} onChange={handleLotOriginChange} required disabled>
                <option value="">Selecciona entrada</option>
                {availableEntryOrigins.map((entry) => (
                  <option key={entry.id_entrada} value={entry.id_entrada}>
                    {`#${entry.id_entrada} - ${entry.producto_nombre || `Producto ${entry.id_producto}`} - ${entry.nombre_empresa || `Proveedor ${entry.id_proveedor}`}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Producto *
              <select name="id_producto" value={lotForm.id_producto} onChange={handleLotFieldChange} required disabled={Boolean(editingLotId)}>
                <option value="">Selecciona producto</option>
                {products.map((product) => (
                  <option key={product.id_producto} value={product.id_producto}>
                    {product.nombre || `Producto #${product.id_producto}`}
                  </option>
                ))}
              </select>
              {editingLotId ? <small>El producto no se puede modificar en edición.</small> : null}
            </label>

            <label>
              Proveedor *
              <select name="id_proveedor" value={lotForm.id_proveedor} onChange={handleLotFieldChange} required disabled>
                <option value="">Selecciona proveedor</option>
                {providers.map((provider) => (
                  <option key={provider.id_proveedor} value={provider.id_proveedor}>
                    {provider.nombre_empresa || `Proveedor #${provider.id_proveedor}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha recepcion *
              <input
                name="fecha_recepcion"
                type="date"
                value={lotForm.fecha_recepcion}
                onChange={handleLotFieldChange}
                required
                disabled
              />
            </label>

            <label>
              Cantidad unidades
              <input
                name="cantidad_unidades"
                type="number"
                min="0"
                step="1"
                value={lotForm.cantidad_unidades}
                onChange={handleLotFieldChange}
                placeholder="0"
                disabled
              />
            </label>

            <label>
              Peso inicial (kg) *
              <input
                name="peso_inicial_kg"
                type="number"
                min="0"
                step="0.01"
                value={lotForm.peso_inicial_kg}
                onChange={handleLotFieldChange}
                placeholder="0.00"
                required
                disabled
              />
            </label>

            <label>
              Estado maduracion
              <select
                name="estado_maduracion"
                value={lotForm.estado_maduracion}
                onChange={handleLotFieldChange}
              >
                {MATURATION_STATES.map((maturationState) => (
                  <option key={maturationState} value={maturationState}>
                    {maturationState}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="provider-form-actions">
            <button type="submit" disabled={isSubmittingLot}>
              {isSubmittingLot ? 'Guardando...' : 'Actualizar lote'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={cancelLotEdit}
              disabled={isSubmittingLot}
            >
              Cancelar edicion
            </button>
          </div>
        </form>
      ) : null}

      <div className="providers-header-row" style={{ marginTop: '12px' }}>
        <div>
          <h4 style={{ marginTop: 0 }}>Lotes de materia prima</h4>
          <p>
            Pendientes: {pendingLots.length} · Activos: {activeLots.length} · Completos: {completedLots.length}
          </p>
        </div>
      </div>

      <div className="maturation-tab-strip">
        {LOT_TABS.map((tab) => {
          const isSelected = selectedLotTab === tab.key
          const tabCount =
            tab.key === PENDING_REGISTRATION_STATE
              ? pendingLots.length
              : tab.key === ACTIVE_REGISTRATION_STATE
                ? activeLots.length
                : completedLots.length

          return (
            <button
              key={tab.key}
              type="button"
              className={isSelected ? 'secondary-button maturation-tab-button is-active' : 'secondary-button maturation-tab-button'}
              onClick={() => setSelectedLotTab(tab.key)}
            >
              {tab.label} ({tabCount})
            </button>
          )
        })}
      </div>

      <div className="maturation-filter-panel">
        <div className="maturation-filter-grid">
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Lote</span>
            <input
              name="lote"
              type="text"
              value={lotFilters.lote}
              onChange={handleLotFilterChange}
              placeholder="#lote o #entrada"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Producto</span>
            <input
              name="producto"
              type="text"
              value={lotFilters.producto}
              onChange={handleLotFilterChange}
              placeholder="Producto"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Proveedor</span>
            <input
              name="proveedor"
              type="text"
              value={lotFilters.proveedor}
              onChange={handleLotFilterChange}
              placeholder="Proveedor"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Mes recepcion</span>
            <input
              name="mes_recepcion"
              type="month"
              value={lotFilters.mes_recepcion}
              onChange={handleLotFilterChange}
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Estado</span>
            <select
              name="estado_maduracion"
              value={lotFilters.estado_maduracion}
              onChange={handleLotFilterChange}
              className="maturation-filter-input"
            >
              <option value="">Todos</option>
              {MATURATION_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="maturation-filter-actions">
          <button type="button" className="secondary-button" onClick={clearLotFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="providers-table-wrap table-limited" style={{ marginTop: '8px' }}>
        <table className="providers-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Entrada origen</th>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Recepcion</th>
              <th>Unidades</th>
              <th>Peso inicial</th>
              <th>Estado registro</th>
              <th>Estado maduracion</th>
              <th>{selectedLotTab === COMPLETE_REGISTRATION_STATE ? 'Sin acciones' : 'Acciones'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="10" className="empty-table-cell">
                  No hay lotes en esta pestaña.
                </td>
              </tr>
            ) : null}

            {filteredLots.map((lot) => {
              const isPending = lot.estado_registro === PENDING_REGISTRATION_STATE
              const isActive = lot.estado_registro === ACTIVE_REGISTRATION_STATE
              const isComplete = lot.estado_registro === COMPLETE_REGISTRATION_STATE

              return (
                <tr key={lot.id_lote_mp}>
                  <td>#{lot.id_lote_mp}</td>
                  <td>{lot.id_entrada_origen ? `#${lot.id_entrada_origen}` : '-'}</td>
                  <td>{lot.producto_nombre || `Producto #${lot.id_producto}`}</td>
                  <td>{lot.proveedor_nombre || `Proveedor #${lot.id_proveedor}`}</td>
                  <td>{lot.fecha_recepcion || '-'}</td>
                  <td>{lot.cantidad_unidades ?? '-'}</td>
                  <td>{lot.peso_inicial_kg ?? '-'}</td>
                  <td>{lot.estado_registro || '-'}</td>
                  <td>{lot.estado_maduracion || '-'}</td>
                  <td className="table-actions">
                    {isPending ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleAcceptPendingLot(lot)}
                        disabled={isSubmittingLot}
                      >
                        Aceptar
                      </button>
                    ) : null}

                    {isActive ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => selectLotForControl(lot)}
                        title={lot.id_entrada_origen ? 'Seleccionar para control' : 'Se abrirá la medición aunque no se muestre origen'}
                      >
                        Medir
                      </button>
                    ) : null}

                    {isActive ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleMarkReadyForProduction(lot)}
                        disabled={isSubmittingLot}
                      >
                        Completar
                      </button>
                    ) : null}

                    {!isComplete ? (
                      <button type="button" className="secondary-button" onClick={() => handleEditLot(lot)}>
                        Editar
                      </button>
                    ) : null}

                    {!isComplete ? (
                      <button type="button" className="danger-button" onClick={() => handleDeleteLot(lot.id_lote_mp)}>
                        Eliminar
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="maturation-section-divider" aria-hidden="true" />

      <div className="maturation-filter-panel maturation-filter-panel--controls">
        <div className="maturation-filter-grid maturation-filter-grid--controls">
          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Mes medicion</span>
            <input
              name="mes_medicion"
              type="month"
              value={controlFilters.mes_medicion}
              onChange={handleControlFilterChange}
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Lote</span>
            <input
              name="lote"
              type="text"
              value={controlFilters.lote}
              onChange={handleControlFilterChange}
              placeholder="#lote"
              className="maturation-filter-input"
            />
          </label>

          <label className="maturation-filter-field">
            <span className="maturation-filter-label">Producto</span>
            <input
              name="producto"
              type="text"
              value={controlFilters.producto}
              onChange={handleControlFilterChange}
              placeholder="Producto"
              className="maturation-filter-input"
            />
          </label>
        </div>

        <div className="maturation-filter-actions">
          <button type="button" className="secondary-button" onClick={clearControlFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {controlModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card entry-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Registrar control de maduracion</h4>
                <p style={{ margin: 0 }}>Ingresa la medicion del lote seleccionado.</p>
              </div>
              <button type="button" className="secondary-button" onClick={closeControlModal}>
                Cerrar
              </button>
            </div>

            <form className="provider-form" onSubmit={handleControlSubmit} style={{ marginTop: '16px' }}>
              <div className="provider-form-grid">
                <label>
                  Lote *
                  <select name="id_lote_mp" value={controlForm.id_lote_mp} onChange={handleControlFieldChange} required>
                    <option value="">Selecciona lote</option>
                    {availableControlLots.map((lot) => (
                      <option key={lot.id_lote_mp} value={lot.id_lote_mp}>
                        {`#${lot.id_lote_mp} - ${lot.producto_nombre || `Producto ${lot.id_producto}`}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Grados Brix *
                  <input
                    name="grados_brix"
                    type="number"
                    min="0"
                    step="0.01"
                    value={controlForm.grados_brix}
                    onChange={handleControlFieldChange}
                    placeholder="0.00"
                    required
                  />
                </label>

                <label>
                  Temperatura cuarto
                  <input
                    name="temperatura_cuarto"
                    type="number"
                    step="0.01"
                    value={controlForm.temperatura_cuarto}
                    onChange={handleControlFieldChange}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Observaciones
                  <input
                    name="observaciones"
                    type="text"
                    value={controlForm.observaciones}
                    onChange={handleControlFieldChange}
                    placeholder="Notas adicionales"
                  />
                </label>
              </div>

              <div className="provider-form-actions">
                <button type="submit" disabled={isSubmittingControl}>
                  {isSubmittingControl ? 'Guardando...' : 'Registrar control'}
                </button>
                <button type="button" className="secondary-button" onClick={closeControlModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {moduleError ? <p className="feedback error">{moduleError}</p> : null}
      {moduleNotice ? <p className="feedback success">{moduleNotice}</p> : null}

      <div className="providers-table-wrap table-limited" style={{ marginTop: '12px' }}>
        <table className="providers-table">
          <thead>
            <tr>
              <th>Fecha medicion</th>
              <th>Lote</th>
              <th>Producto</th>
              <th>Brix</th>
              <th>Temperatura</th>
              <th>Observaciones</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredControls.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No hay controles registrados para los filtros seleccionados.
                </td>
              </tr>
            ) : null}

            {filteredControls.map((control) => (
              <tr key={control.id_control}>
                <td>{control.fecha_medicion ? new Date(control.fecha_medicion).toLocaleString('es-GT') : '-'}</td>
                <td>#{control.id_lote_mp}</td>
                <td>{control.producto_nombre || '-'}</td>
                <td>{control.grados_brix ?? '-'}</td>
                <td>{control.temperatura_cuarto ?? '-'}</td>
                <td>{control.observaciones || '-'}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDeleteControl(control.id_control)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default MaturationControlModule
