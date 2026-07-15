import { useEffect, useState } from 'react'
import {
  createServiceTypeRequest,
  deleteServiceTypeRequest,
  listServiceTypesRequest,
  updateServiceTypeRequest,
} from '../../services/serviceType.service'

const EMPTY_SERVICE_TYPE_FORM = {
  nombre_servicio: '',
  descripcion: '',
  km_frecuencia: '',
}

const normalizePayload = (form) => ({
  nombre_servicio: form.nombre_servicio.trim(),
  descripcion: form.descripcion.trim() || undefined,
  km_frecuencia: form.km_frecuencia === '' ? undefined : Number(form.km_frecuencia),
})

function ServiceTypesModule({ token, isActive }) {
  const [serviceTypes, setServiceTypes] = useState([])
  const [serviceTypeForm, setServiceTypeForm] = useState(EMPTY_SERVICE_TYPE_FORM)
  const [editingServiceTypeId, setEditingServiceTypeId] = useState(null)
  const [isServiceTypesLoading, setIsServiceTypesLoading] = useState(false)
  const [isServiceTypeSubmitting, setIsServiceTypeSubmitting] = useState(false)
  const [serviceTypesError, setServiceTypesError] = useState('')
  const [serviceTypesNotice, setServiceTypesNotice] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadServiceTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadServiceTypes = async () => {
    setServiceTypesError('')
    setIsServiceTypesLoading(true)

    try {
      const data = await listServiceTypesRequest(token)
      setServiceTypes(Array.isArray(data) ? data : [])
    } catch (error) {
      setServiceTypesError(error.message || 'No se pudieron cargar tipos de servicio')
    } finally {
      setIsServiceTypesLoading(false)
    }
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setServiceTypeForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setServiceTypesError('')
    setServiceTypesNotice('')
    setIsServiceTypeSubmitting(true)

    try {
      const payload = normalizePayload(serviceTypeForm)

      if (editingServiceTypeId) {
        await updateServiceTypeRequest(editingServiceTypeId, payload, token)
        setServiceTypesNotice('Tipo de servicio actualizado correctamente')
      } else {
        await createServiceTypeRequest(payload, token)
        setServiceTypesNotice('Tipo de servicio creado correctamente')
      }

      setServiceTypeForm(EMPTY_SERVICE_TYPE_FORM)
      setEditingServiceTypeId(null)
      await loadServiceTypes()
    } catch (error) {
      setServiceTypesError(error.message || 'No se pudo guardar tipo de servicio')
    } finally {
      setIsServiceTypeSubmitting(false)
    }
  }

  const handleEdit = (serviceType) => {
    setEditingServiceTypeId(serviceType.id_tipo_servicio)
    setServiceTypeForm({
      nombre_servicio: serviceType.nombre_servicio || '',
      descripcion: serviceType.descripcion || '',
      km_frecuencia:
        serviceType.km_frecuencia === null || serviceType.km_frecuencia === undefined
          ? ''
          : String(serviceType.km_frecuencia),
    })
    setServiceTypesNotice('')
    setServiceTypesError('')
  }

  const cancelEdit = () => {
    setEditingServiceTypeId(null)
    setServiceTypeForm(EMPTY_SERVICE_TYPE_FORM)
    setServiceTypesNotice('')
  }

  const handleDelete = async (serviceTypeId) => {
    const confirmDelete = window.confirm(
      'Esta accion eliminara el tipo de servicio seleccionado. Deseas continuar?'
    )

    if (!confirmDelete) {
      return
    }

    setServiceTypesError('')
    setServiceTypesNotice('')

    try {
      await deleteServiceTypeRequest(serviceTypeId, token)
      setServiceTypesNotice('Tipo de servicio eliminado correctamente')
      await loadServiceTypes()

      if (editingServiceTypeId === serviceTypeId) {
        cancelEdit()
      }
    } catch (error) {
      setServiceTypesError(error.message || 'No se pudo eliminar tipo de servicio')
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de tipos de servicio">
      <div className="providers-header-row">
        <div>
          <h3>Tipos de Servicio</h3>
          <p>Catalogo base para clasificar futuros servicios de mantenimiento.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={loadServiceTypes}
          disabled={isServiceTypesLoading}
        >
          {isServiceTypesLoading ? 'Actualizando...' : 'Recargar'}
        </button>
      </div>

      <form className="provider-form" onSubmit={handleSubmit}>
        <div className="provider-form-grid">
          <label>
            Nombre del servicio *
            <input
              name="nombre_servicio"
              type="text"
              value={serviceTypeForm.nombre_servicio}
              onChange={handleFieldChange}
              placeholder="Cambio de aceite"
              required
            />
          </label>

          <label>
            Frecuencia (km)
            <input
              name="km_frecuencia"
              type="number"
              min="0"
              step="1"
              value={serviceTypeForm.km_frecuencia}
              onChange={handleFieldChange}
              placeholder="5000"
            />
          </label>

          <label>
            Descripcion
            <input
              name="descripcion"
              type="text"
              value={serviceTypeForm.descripcion}
              onChange={handleFieldChange}
              placeholder="Detalles opcionales"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isServiceTypeSubmitting}>
            {isServiceTypeSubmitting
              ? 'Guardando...'
              : editingServiceTypeId
                ? 'Actualizar tipo'
                : 'Crear tipo'}
          </button>

          {editingServiceTypeId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelEdit}
              disabled={isServiceTypeSubmitting}
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

      {serviceTypesError ? <p className="feedback error">{serviceTypesError}</p> : null}
      {serviceTypesNotice ? <p className="feedback success">{serviceTypesNotice}</p> : null}

      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripcion</th>
              <th>Frecuencia (km)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.length === 0 && !isServiceTypesLoading ? (
              <tr>
                <td colSpan="4" className="empty-table-cell">
                  No hay tipos de servicio registrados.
                </td>
              </tr>
            ) : null}

            {serviceTypes.map((serviceType) => (
              <tr key={serviceType.id_tipo_servicio}>
                <td>{serviceType.nombre_servicio || '-'}</td>
                <td>{serviceType.descripcion || '-'}</td>
                <td>{serviceType.km_frecuencia ?? '-'}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleEdit(serviceType)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDelete(serviceType.id_tipo_servicio)}
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

export default ServiceTypesModule
