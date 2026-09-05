import { useEffect, useMemo, useState } from 'react'
import { listServiceTypesRequest } from '../../services/serviceType.service'
import { listVehiclesRequest } from '../../services/vehicle.service'
import {
  createVehicleServiceRequest,
  deleteVehicleServiceRequest,
  listVehicleServicesRequest,
  updateVehicleServiceRequest,
} from '../../services/vehicleService.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const EMPTY_FORM = {
  id_vehiculo: '',
  id_tipo_servicio: '',
  fecha_servicio: '',
  km_en_servicio: '',
  costo_servicio: '',
  proximo_servicio_km: '',
  notas: '',
}

const normalizePayload = (form) => ({
  id_vehiculo: Number(form.id_vehiculo),
  id_tipo_servicio: Number(form.id_tipo_servicio),
  fecha_servicio: form.fecha_servicio,
  km_en_servicio: Number(form.km_en_servicio),
  costo_servicio: form.costo_servicio === '' ? undefined : Number(form.costo_servicio),
  proximo_servicio_km:
    form.proximo_servicio_km === '' ? undefined : Number(form.proximo_servicio_km),
  notas: form.notas.trim() || undefined,
})

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-GT')
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numberValue = Number(value)

  if (Number.isNaN(numberValue)) {
    return '-'
  }

  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue)
}

function VehicleServicesModule({ token, isActive }) {
  const [services, setServices] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [serviceTypes, setServiceTypes] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingServiceId, setEditingServiceId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const vehicleOptions = useMemo(() => vehicles, [vehicles])
  const serviceTypeOptions = useMemo(() => serviceTypes, [serviceTypes])

  const loadData = async () => {
    setErrorMessage('')
    setIsLoading(true)

    try {
      const [servicesData, vehiclesData, serviceTypesData] = await Promise.all([
        listVehicleServicesRequest(token),
        listVehiclesRequest(token),
        listServiceTypesRequest(token),
      ])

      setServices(Array.isArray(servicesData) ? servicesData : [])
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
      setServiceTypes(Array.isArray(serviceTypesData) ? serviceTypesData : [])
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo cargar el control de servicios')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => {
      const nextForm = {
        ...previous,
        [name]: value,
      }

      if (name === 'id_vehiculo') {
        const selectedVehicle = vehicles.find((vehicle) => String(vehicle.id_vehiculo) === value)
        nextForm.km_en_servicio =
          selectedVehicle?.kilometraje_actual === null || selectedVehicle?.kilometraje_actual === undefined
            ? ''
            : String(selectedVehicle.kilometraje_actual)
      }

      return nextForm
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setNoticeMessage('')
    setIsSubmitting(true)

    try {
      const payload = normalizePayload(form)

      if (editingServiceId) {
        await updateVehicleServiceRequest(editingServiceId, payload, token)
        setNoticeMessage('Servicio de vehiculo actualizado correctamente')
        notifySuccess('Servicio de vehiculo actualizado correctamente')
      } else {
        await createVehicleServiceRequest(payload, token)
        setNoticeMessage('Servicio de vehiculo creado correctamente')
        notifySuccess('Servicio de vehiculo creado correctamente')
      }

      setForm(EMPTY_FORM)
      setEditingServiceId(null)
      await loadData()
    } catch (error) {
      const message = error.message || 'No se pudo guardar el servicio de vehiculo'
      setErrorMessage(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (service) => {
    setEditingServiceId(service.id_servicio)
    setForm({
      id_vehiculo: service.id_vehiculo ? String(service.id_vehiculo) : '',
      id_tipo_servicio: service.id_tipo_servicio ? String(service.id_tipo_servicio) : '',
      fecha_servicio: service.fecha_servicio ? String(service.fecha_servicio).slice(0, 10) : '',
      km_en_servicio:
        service.km_en_servicio === null || service.km_en_servicio === undefined
          ? ''
          : String(service.km_en_servicio),
      costo_servicio:
        service.costo_servicio === null || service.costo_servicio === undefined
          ? ''
          : String(service.costo_servicio),
      proximo_servicio_km:
        service.proximo_servicio_km === null || service.proximo_servicio_km === undefined
          ? ''
          : String(service.proximo_servicio_km),
      notas: service.notas || '',
    })
    setNoticeMessage('')
    setErrorMessage('')
  }

  const cancelEdit = () => {
    setEditingServiceId(null)
    setForm(EMPTY_FORM)
    setNoticeMessage('')
  }

  const handleDelete = async (serviceId) => {
    const confirmDelete = window.confirm(
      'Esta accion eliminara el servicio seleccionado. Deseas continuar?'
    )

    if (!confirmDelete) {
      return
    }

    setErrorMessage('')
    setNoticeMessage('')

    try {
      await deleteVehicleServiceRequest(serviceId, token)
      setNoticeMessage('Servicio de vehiculo eliminado correctamente')
      notifySuccess('Servicio de vehiculo eliminado correctamente')
      await loadData()

      if (editingServiceId === serviceId) {
        cancelEdit()
      }
    } catch (error) {
      const message = error.message || 'No se pudo eliminar el servicio de vehiculo'
      setErrorMessage(message)
      notifyError(message)
    }
  }

  const getVehicleLabel = (vehicle) => {
    const parts = [vehicle.placa, vehicle.modelo].filter(Boolean)
    return parts.length > 0 ? parts.join(' - ') : `Vehiculo #${vehicle.id_vehiculo}`
  }

  return (
    <section className="panel-card" aria-label="Control de servicios de vehiculo">
      <ReloadButton onClick={loadData} isLoading={isLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Servicios de Vehiculo</h3>
          <p>Registro de mantenimientos, costos y proximo kilometraje por unidad.</p>
        </div>
      </div>

      <form className="provider-form" onSubmit={handleSubmit}>
        <div className="provider-form-grid">
          <label>
            Vehiculo *
            <select name="id_vehiculo" value={form.id_vehiculo} onChange={handleFieldChange} required>
              <option value="">Selecciona un vehiculo</option>
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                  {getVehicleLabel(vehicle)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tipo de servicio *
            <select
              name="id_tipo_servicio"
              value={form.id_tipo_servicio}
              onChange={handleFieldChange}
              required
            >
              <option value="">Selecciona un tipo</option>
              {serviceTypeOptions.map((serviceType) => (
                <option key={serviceType.id_tipo_servicio} value={serviceType.id_tipo_servicio}>
                  {serviceType.nombre_servicio}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fecha de servicio *
            <input
              name="fecha_servicio"
              type="date"
              value={form.fecha_servicio}
              onChange={handleFieldChange}
              required
            />
          </label>

          <label>
            Km en servicio *
            <input
              name="km_en_servicio"
              type="number"
              min="0"
              step="0.01"
              value={form.km_en_servicio}
              onChange={handleFieldChange}
              placeholder="0.00"
              required
              readOnly
            />
          </label>

          <label>
            Costo del servicio
            <input
              name="costo_servicio"
              type="number"
              min="0"
              step="0.01"
              value={form.costo_servicio}
              onChange={handleFieldChange}
              placeholder="0.00"
            />
          </label>

          <label>
            Proximo servicio km
            <input
              name="proximo_servicio_km"
              type="number"
              min="0"
              step="0.01"
              value={form.proximo_servicio_km}
              onChange={handleFieldChange}
              placeholder="0.00"
            />
          </label>

          <label className="full-width-field">
            Notas
            <textarea
              name="notas"
              rows="3"
              value={form.notas}
              onChange={handleFieldChange}
              placeholder="Observaciones del mantenimiento"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : editingServiceId ? 'Actualizar servicio' : 'Crear servicio'}
          </button>

          {editingServiceId ? (
            <button type="button" className="secondary-button" onClick={cancelEdit} disabled={isSubmitting}>
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

      {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
      {noticeMessage ? <p className="feedback success">{noticeMessage}</p> : null}

      <div className="maturation-section-divider" aria-hidden="true" />

      <CollapsibleSection title="Listado de servicios" defaultCollapsed storageKey="module:collapsed:list:vehicleServices">
      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Vehiculo</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Km</th>
              <th>Costo</th>
              <th>Proximo km</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 && !isLoading ? (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  No hay servicios de vehiculo registrados.
                </td>
              </tr>
            ) : null}

            {services.map((service) => (
              <tr key={service.id_servicio}>
                <td>{service.vehiculo_placa || service.id_vehiculo || '-'}</td>
                <td>{service.tipo_servicio_nombre || service.id_tipo_servicio || '-'}</td>
                <td>{formatDate(service.fecha_servicio)}</td>
                <td>{service.km_en_servicio ?? '-'}</td>
                <td>{formatCurrency(service.costo_servicio)}</td>
                <td>{service.proximo_servicio_km ?? '-'}</td>
                <td>{service.notas || '-'}</td>
                <td className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => handleEdit(service)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDelete(service.id_servicio)}
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

export default VehicleServicesModule