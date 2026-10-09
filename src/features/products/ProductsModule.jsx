import { useEffect, useState } from 'react'
import {
  createProductRequest,
  deleteProductRequest,
  listProductsRequest,
  updateProductRequest,
} from '../../services/product.service'
import {
  createStageTypeRequest,
  getProductStageRequirementsRequest,
  listStageTypesRequest,
} from '../../services/production.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const PRODUCT_TYPES = ['Materia Prima', 'Producto Terminado', 'Insumo', 'Venta Directa']
const UNIT_OPTIONS = ['Lb', 'Kg', 'Unidades', 'Litros', 'Galones']
const FINISHED_PRODUCT_TYPE = 'Producto Terminado'

const EMPTY_PRODUCT_FORM = {
  nombre: '',
  descripcion: '',
  unidad_medida: '',
  tipo_producto: PRODUCT_TYPES[0],
  stock_minimo: '',
  precio_venta_sugerido: '',
}

const normalizeProductPayload = (productForm) => {
  const payload = {
    nombre: productForm.nombre,
    descripcion: productForm.descripcion || undefined,
    unidad_medida: productForm.unidad_medida || undefined,
    tipo_producto: productForm.tipo_producto,
  }

  if (productForm.stock_minimo !== '') {
    payload.stock_minimo = Number(productForm.stock_minimo)
  }

  if (productForm.precio_venta_sugerido !== '') {
    payload.precio_venta_sugerido = Number(productForm.precio_venta_sugerido)
  }

  return payload
}

const EMPTY_STAGE_TYPE_QUICK_ADD = {
  nombre_etapa: '',
}

function ProductsModule({ token, isActive }) {
  const [products, setProducts] = useState([])
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM)
  const [editingProductId, setEditingProductId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [isProductSubmitting, setIsProductSubmitting] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productsNotice, setProductsNotice] = useState('')

  // Un Producto Terminado no puede crearse sin un plan de proceso (etapas que debe cumplir).
  // El plan se arma en el mismo formulario de creacion, no en un paso aparte.
  const [stageTypes, setStageTypes] = useState([])
  const [planDraft, setPlanDraft] = useState([])
  const [planNewStageId, setPlanNewStageId] = useState('')
  const [stageTypeQuickAddOpen, setStageTypeQuickAddOpen] = useState(false)
  const [stageTypeQuickAddForm, setStageTypeQuickAddForm] = useState(EMPTY_STAGE_TYPE_QUICK_ADD)
  const [isCreatingStageType, setIsCreatingStageType] = useState(false)

  // Plan de proceso vigente del producto que se esta editando (solo lectura: el plan en si se
  // edita desde Produccion -> "Etapas por producto", aqui solo se muestra para que el usuario
  // pueda verlo sin tener que cambiar de modulo).
  const [editingProductPlan, setEditingProductPlan] = useState([])
  const [isLoadingEditingProductPlan, setIsLoadingEditingProductPlan] = useState(false)

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadProducts()
    loadStageTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadStageTypes = async () => {
    try {
      const data = await listStageTypesRequest(token)
      setStageTypes(Array.isArray(data) ? data : [])
    } catch (error) {
      // El catalogo de etapas es secundario a la lista de productos: si falla, el plan de
      // proceso simplemente aparecera sin opciones para elegir, sin bloquear el modulo.
      setStageTypes([])
    }
  }

  const loadProducts = async () => {
    setProductsError('')
    setIsProductsLoading(true)

    try {
      const data = await listProductsRequest(token)
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      setProductsError(error.message || 'No se pudo cargar productos')
    } finally {
      setIsProductsLoading(false)
    }
  }

  const handleProductFieldChange = (event) => {
    const { name, value } = event.target
    setProductForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    // Si se cambia el tipo lejos de Producto Terminado, el plan armado hasta ahora ya no aplica.
    if (name === 'tipo_producto' && value !== FINISHED_PRODUCT_TYPE) {
      setPlanDraft([])
      setPlanNewStageId('')
    }
  }

  const planDraftIds = new Set(planDraft.map((item) => item.id_tipo_etapa))
  const availableStageTypesForPlan = stageTypes.filter((stageType) => !planDraftIds.has(stageType.id_tipo_etapa))
  const isCreatingFinishedProduct = !editingProductId && productForm.tipo_producto === FINISHED_PRODUCT_TYPE

  const handleAddPlanStage = () => {
    if (!planNewStageId) {
      return
    }

    const stageType = stageTypes.find((item) => String(item.id_tipo_etapa) === planNewStageId)

    if (!stageType) {
      return
    }

    setPlanDraft((previous) => [
      ...previous,
      { id_tipo_etapa: stageType.id_tipo_etapa, nombre_etapa: stageType.nombre_etapa },
    ])
    setPlanNewStageId('')
  }

  const handleRemovePlanStage = (index) => {
    setPlanDraft((previous) => previous.filter((_, i) => i !== index))
  }

  const handleMovePlanStage = (index, direction) => {
    setPlanDraft((previous) => {
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

  const openStageTypeQuickAdd = () => {
    setStageTypeQuickAddForm(EMPTY_STAGE_TYPE_QUICK_ADD)
    setStageTypeQuickAddOpen(true)
  }

  const handleStageTypeQuickAddFieldChange = (event) => {
    const { name, value } = event.target
    setStageTypeQuickAddForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleCreateStageTypeQuickAdd = async (event) => {
    event.preventDefault()
    setProductsError('')
    setIsCreatingStageType(true)

    try {
      const newStageType = await createStageTypeRequest(
        { nombre_etapa: stageTypeQuickAddForm.nombre_etapa.trim() },
        token
      )

      const updatedTypes = await listStageTypesRequest(token)
      setStageTypes(Array.isArray(updatedTypes) ? updatedTypes : [])
      setPlanNewStageId(String(newStageType.id_tipo_etapa))
      setStageTypeQuickAddOpen(false)
      notifySuccess('Tipo de etapa creado correctamente')
    } catch (error) {
      const message = error.message || 'No se pudo registrar el tipo de etapa'
      setProductsError(message)
      notifyError(message)
    } finally {
      setIsCreatingStageType(false)
    }
  }

  const handleProductSubmit = async (event) => {
    event.preventDefault()
    setProductsError('')
    setProductsNotice('')

    if (isCreatingFinishedProduct && planDraft.length === 0) {
      setProductsError('Debes definir al menos una etapa en el plan de proceso antes de crear el producto.')
      return
    }

    setIsProductSubmitting(true)

    try {
      const payload = normalizeProductPayload(productForm)

      if (isCreatingFinishedProduct) {
        payload.etapas = planDraft.map((item) => item.id_tipo_etapa)
      }

      if (editingProductId) {
        await updateProductRequest(editingProductId, payload, token)
        setProductsNotice('Producto actualizado correctamente')
        notifySuccess('Producto actualizado correctamente')
      } else {
        await createProductRequest(payload, token)
        setProductsNotice('Producto creado correctamente')
        notifySuccess('Producto creado correctamente')
      }

      setProductForm(EMPTY_PRODUCT_FORM)
      setEditingProductId(null)
      setPlanDraft([])
      setPlanNewStageId('')
      setFormOpen(false)
      await loadProducts()
    } catch (error) {
      const message = error.message || 'No se pudo guardar producto'
      setProductsError(message)
      notifyError(message)
    } finally {
      setIsProductSubmitting(false)
    }
  }

  const openCreateForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM)
    setPlanDraft([])
    setPlanNewStageId('')
    setProductsNotice('')
    setProductsError('')
    setFormOpen(true)
  }

  const handleProductEdit = async (product) => {
    setEditingProductId(product.id_producto)
    setProductForm({
      nombre: product.nombre || '',
      descripcion: product.descripcion || '',
      unidad_medida: product.unidad_medida || '',
      tipo_producto: product.tipo_producto || PRODUCT_TYPES[0],
      stock_minimo: product.stock_minimo ?? '',
      precio_venta_sugerido: product.precio_venta_sugerido ?? '',
    })
    setProductsNotice('')
    setProductsError('')
    setFormOpen(true)
    setEditingProductPlan([])

    if (product.tipo_producto === FINISHED_PRODUCT_TYPE) {
      setIsLoadingEditingProductPlan(true)
      try {
        const requirements = await getProductStageRequirementsRequest(product.id_producto, token)
        setEditingProductPlan(Array.isArray(requirements) ? requirements : [])
      } catch (error) {
        // El plan es informativo en esta pantalla: si falla la carga, solo se omite y el
        // enlace a Produccion sigue disponible para verlo/editarlo alla.
        setEditingProductPlan([])
      } finally {
        setIsLoadingEditingProductPlan(false)
      }
    }
  }

  const cancelProductEdit = () => {
    setEditingProductId(null)
    setProductForm(EMPTY_PRODUCT_FORM)
    setPlanDraft([])
    setPlanNewStageId('')
    setEditingProductPlan([])
    setProductsNotice('')
    setFormOpen(false)
  }

  const handleProductDelete = async (productId) => {
    const confirmDelete = window.confirm(
      'Esta accion eliminara el producto seleccionado. Deseas continuar?'
    )

    if (!confirmDelete) {
      return
    }

    setProductsError('')
    setProductsNotice('')

    try {
      await deleteProductRequest(productId, token)
      setProductsNotice('Producto eliminado correctamente')
      notifySuccess('Producto eliminado correctamente')
      await loadProducts()

      if (editingProductId === productId) {
        cancelProductEdit()
      }
    } catch (error) {
      const message = error.message || 'No se pudo eliminar producto'
      setProductsError(message)
      notifyError(message)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de productos">
      <ReloadButton onClick={loadProducts} isLoading={isProductsLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Modulo Productos</h3>
          <p>Gestion de productos con tipo, stock minimo y precio sugerido.</p>
        </div>
        {!formOpen ? (
          <button type="button" className="primary-button" onClick={openCreateForm}>
            + Agregar producto
          </button>
        ) : null}
      </div>

      {formOpen ? (
      <form className="provider-form" onSubmit={handleProductSubmit}>
        <div className="provider-form-grid">
          <label>
            Nombre *
            <input
              name="nombre"
              type="text"
              value={productForm.nombre}
              onChange={handleProductFieldChange}
              placeholder="Nombre del producto"
              required
            />
          </label>

          <label>
            Tipo producto *
            <select
              name="tipo_producto"
              value={productForm.tipo_producto}
              onChange={handleProductFieldChange}
              required
            >
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Unidad medida
            <select
              name="unidad_medida"
              value={productForm.unidad_medida}
              onChange={handleProductFieldChange}
            >
              <option value="">Selecciona unidad</option>
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            Stock minimo
            <input
              name="stock_minimo"
              type="number"
              min="0"
              step="1"
              value={productForm.stock_minimo}
              onChange={handleProductFieldChange}
              placeholder="10"
            />
          </label>

          <label>
            Precio sugerido
            <input
              name="precio_venta_sugerido"
              type="number"
              min="0"
              step="0.01"
              value={productForm.precio_venta_sugerido}
              onChange={handleProductFieldChange}
              placeholder="0.00"
            />
          </label>

          <label className="full-width-field">
            Descripcion
            <input
              name="descripcion"
              type="text"
              value={productForm.descripcion}
              onChange={handleProductFieldChange}
              placeholder="Detalle del producto"
            />
          </label>
        </div>

        {isCreatingFinishedProduct ? (
          <>
            <div className="maturation-section-divider" aria-hidden="true" />

            <h4 style={{ marginTop: 0 }}>Plan de proceso *</h4>
            <p className="widget-muted" style={{ marginTop: 0 }}>
              Un producto terminado debe cumplir estas etapas, en este orden, antes de poder finalizarse en Produccion.
            </p>

            {planDraft.length === 0 ? (
              <p className="widget-muted">Aun no agregas ninguna etapa a este plan.</p>
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
                    {planDraft.map((item, index) => (
                      <tr key={`${item.id_tipo_etapa}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.nombre_etapa}</td>
                        <td className="table-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleMovePlanStage(index, -1)}
                            disabled={index === 0}
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleMovePlanStage(index, 1)}
                            disabled={index === planDraft.length - 1}
                          >
                            Bajar
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleRemovePlanStage(index)}
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
                aria-label="Etapa a agregar al plan"
                value={planNewStageId}
                onChange={(event) => setPlanNewStageId(event.target.value)}
              >
                <option value="">Selecciona una etapa para agregar</option>
                {availableStageTypesForPlan.map((stageType) => (
                  <option key={stageType.id_tipo_etapa} value={stageType.id_tipo_etapa}>
                    {stageType.nombre_etapa}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button"
                onClick={handleAddPlanStage}
                disabled={!planNewStageId}
              >
                + Agregar al plan
              </button>
              {!stageTypeQuickAddOpen ? (
                <button type="button" className="secondary-button" onClick={openStageTypeQuickAdd}>
                  + Nuevo tipo de etapa
                </button>
              ) : null}
            </div>

            {stageTypeQuickAddOpen ? (
              <div className="provider-form-grid" style={{ marginTop: 12 }}>
                <label>
                  Nombre de la nueva etapa *
                  <input
                    name="nombre_etapa"
                    type="text"
                    value={stageTypeQuickAddForm.nombre_etapa}
                    onChange={handleStageTypeQuickAddFieldChange}
                    placeholder="Ej. Limpieza y empaque por cajas"
                  />
                </label>
                <div className="provider-form-actions" style={{ alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleCreateStageTypeQuickAdd}
                    disabled={isCreatingStageType || !stageTypeQuickAddForm.nombre_etapa.trim()}
                  >
                    {isCreatingStageType ? 'Creando...' : 'Crear tipo de etapa'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setStageTypeQuickAddOpen(false)}
                    disabled={isCreatingStageType}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {editingProductId && productForm.tipo_producto === FINISHED_PRODUCT_TYPE ? (
          <>
            <div className="maturation-section-divider" aria-hidden="true" />

            <h4 style={{ marginTop: 0 }}>Plan de proceso vigente</h4>

            {isLoadingEditingProductPlan ? (
              <p className="widget-muted">Cargando plan de proceso...</p>
            ) : editingProductPlan.length === 0 ? (
              <p className="widget-muted">Este producto no tiene un plan de proceso registrado.</p>
            ) : (
              <div className="providers-table-wrap table-limited">
                <table className="providers-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingProductPlan.map((item, index) => (
                      <tr key={item.id_requisito ?? `${item.id_tipo_etapa}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.nombre_etapa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="widget-muted">
              Para modificar el plan de proceso de este producto, ve a Produccion → pestana "Etapas por producto".
            </p>
          </>
        ) : null}

        <div className="provider-form-actions">
          <button type="submit" disabled={isProductSubmitting}>
            {isProductSubmitting
              ? 'Guardando...'
              : editingProductId
                ? 'Actualizar producto'
                : 'Crear producto'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={cancelProductEdit}
            disabled={isProductSubmitting}
          >
            {editingProductId ? 'Cancelar edicion' : 'Cancelar'}
          </button>
        </div>
      </form>
      ) : null}

      {productsError ? <p className="feedback error">{productsError}</p> : null}
      {productsNotice ? <p className="feedback success">{productsNotice}</p> : null}

      <div className="maturation-section-divider" aria-hidden="true" />

      <CollapsibleSection title="Listado de productos" defaultCollapsed storageKey="module:collapsed:list:products">
      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Stock minimo</th>
              <th>Precio sugerido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && !isProductsLoading ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No hay productos registrados.
                </td>
              </tr>
            ) : null}

            {products.map((product) => (
              <tr key={product.id_producto}>
                <td>{product.nombre || '-'}</td>
                <td>{product.tipo_producto || '-'}</td>
                <td>{product.unidad_medida || '-'}</td>
                <td>{product.stock_minimo ?? '-'}</td>
                <td>{product.precio_venta_sugerido ?? '-'}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleProductEdit(product)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleProductDelete(product.id_producto)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </CollapsibleSection>
    </section>
  )
}

export default ProductsModule
