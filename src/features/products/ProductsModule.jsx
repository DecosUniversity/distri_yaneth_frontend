import { useEffect, useState } from 'react'
import {
  createProductRequest,
  deleteProductRequest,
  listProductsRequest,
  updateProductRequest,
} from '../../services/product.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const PRODUCT_TYPES = ['Materia Prima', 'Producto Terminado', 'Insumo', 'Venta Directa']
const UNIT_OPTIONS = ['Lb', 'Kg', 'Unidades', 'Litros', 'Galones']

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

function ProductsModule({ token, isActive }) {
  const [products, setProducts] = useState([])
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM)
  const [editingProductId, setEditingProductId] = useState(null)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [isProductSubmitting, setIsProductSubmitting] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productsNotice, setProductsNotice] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

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
  }

  const handleProductSubmit = async (event) => {
    event.preventDefault()
    setProductsError('')
    setProductsNotice('')
    setIsProductSubmitting(true)

    try {
      const payload = normalizeProductPayload(productForm)

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
      await loadProducts()
    } catch (error) {
      const message = error.message || 'No se pudo guardar producto'
      setProductsError(message)
      notifyError(message)
    } finally {
      setIsProductSubmitting(false)
    }
  }

  const handleProductEdit = (product) => {
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
  }

  const cancelProductEdit = () => {
    setEditingProductId(null)
    setProductForm(EMPTY_PRODUCT_FORM)
    setProductsNotice('')
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
      </div>

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

        <div className="provider-form-actions">
          <button type="submit" disabled={isProductSubmitting}>
            {isProductSubmitting
              ? 'Guardando...'
              : editingProductId
                ? 'Actualizar producto'
                : 'Crear producto'}
          </button>

          {editingProductId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelProductEdit}
              disabled={isProductSubmitting}
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

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
