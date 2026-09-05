import { useEffect, useState } from 'react'
import {
  createVehicleRequest,
  deleteVehicleRequest,
  listVehiclesRequest,
  updateVehicleRequest,
} from '../../services/vehicle.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const VEHICLE_STATES = ['Disponible', 'En ruta', 'Mantenimiento', 'Inactivo']

const EMPTY_VEHICLE_FORM = {
  placa: '',
  modelo: '',
  estado: 'Disponible',
  kilometraje_actual: '',
}

const normalizeVehiclePayload = (vehicleForm) => ({
  placa: vehicleForm.placa.trim().toUpperCase(),
  modelo: vehicleForm.modelo.trim() || undefined,
  estado: vehicleForm.estado,
  kilometraje_actual:
    vehicleForm.kilometraje_actual === ''
      ? undefined
      : Number(vehicleForm.kilometraje_actual),
})

function VehiclesModule({ token, isActive, roleName }) {
  const isPilot = roleName === 'Piloto'
  const [vehicles, setVehicles] = useState([])
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false)
  const [isVehicleSubmitting, setIsVehicleSubmitting] = useState(false)
  const [vehiclesError, setVehiclesError] = useState('')
  const [vehiclesNotice, setVehiclesNotice] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadVehicles = async () => {
    setVehiclesError('')
    setIsVehiclesLoading(true)

    try {
      const data = await listVehiclesRequest(token)
      setVehicles(Array.isArray(data) ? data : [])
    } catch (error) {
      setVehiclesError(error.message || 'No se pudieron cargar vehiculos')
    } finally {
      setIsVehiclesLoading(false)
    }
  }

  const handleVehicleFieldChange = (event) => {
    const { name, value } = event.target

    setVehicleForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleVehicleSubmit = async (event) => {
    event.preventDefault()
    setVehiclesError('')
    setVehiclesNotice('')

    if (isPilot && !editingVehicleId) {
      setVehiclesError('El piloto solo puede actualizar el kilometraje de un vehiculo existente')
      return
    }

    setIsVehicleSubmitting(true)

    try {
      const payload = normalizeVehiclePayload(vehicleForm)

      if (editingVehicleId) {
        await updateVehicleRequest(editingVehicleId, payload, token)
        setVehiclesNotice('Vehiculo actualizado correctamente')
        notifySuccess('Vehiculo actualizado correctamente')
      } else {
        await createVehicleRequest(payload, token)
        setVehiclesNotice('Vehiculo creado correctamente')
        notifySuccess('Vehiculo creado correctamente')
      }

      setVehicleForm(EMPTY_VEHICLE_FORM)
      setEditingVehicleId(null)
      await loadVehicles()
    } catch (error) {
      const message = error.message || 'No se pudo guardar vehiculo'
      setVehiclesError(message)
      notifyError(message)
    } finally {
      setIsVehicleSubmitting(false)
    }
  }

  const handleVehicleEdit = (vehicle) => {
    setEditingVehicleId(vehicle.id_vehiculo)
    setVehicleForm({
      placa: vehicle.placa || '',
      modelo: vehicle.modelo || '',
      estado: vehicle.estado || 'Disponible',
      kilometraje_actual:
        vehicle.kilometraje_actual === null || vehicle.kilometraje_actual === undefined
          ? ''
          : String(vehicle.kilometraje_actual),
    })
    setVehiclesNotice('')
    setVehiclesError('')
  }

  const cancelVehicleEdit = () => {
    setEditingVehicleId(null)
    setVehicleForm(EMPTY_VEHICLE_FORM)
    setVehiclesNotice('')
  }

  const handleKilometrajeChange = (event) => {
    const { value } = event.target

    setVehicleForm((previous) => ({
      ...previous,
      kilometraje_actual: value,
    }))
  }

  const handleVehicleDelete = async (vehicleId) => {
    const confirmDelete = window.confirm(
      'Esta accion eliminara el vehiculo seleccionado. Deseas continuar?'
    )

    if (!confirmDelete) {
      return
    }

    setVehiclesError('')
    setVehiclesNotice('')

    try {
      await deleteVehicleRequest(vehicleId, token)
      setVehiclesNotice('Vehiculo eliminado correctamente')
      notifySuccess('Vehiculo eliminado correctamente')
      await loadVehicles()

      if (editingVehicleId === vehicleId) {
        cancelVehicleEdit()
      }
    } catch (error) {
      const message = error.message || 'No se pudo eliminar vehiculo'
      setVehiclesError(message)
      notifyError(message)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de vehiculos">
      <ReloadButton onClick={loadVehicles} isLoading={isVehiclesLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Modulo Vehiculos</h3>
          <p>Gestion de flotilla para operaciones logisticas.</p>
        </div>
      </div>

      <form className="provider-form" onSubmit={handleVehicleSubmit}>
        <div className="provider-form-grid">
          <label>
            Placa *
            <input
              name="placa"
              type="text"
              value={vehicleForm.placa}
              onChange={handleVehicleFieldChange}
              placeholder="P123ABC"
              disabled={isPilot}
              required
            />
          </label>

          <label>
            Modelo
            <input
              name="modelo"
              type="text"
              value={vehicleForm.modelo}
              onChange={handleVehicleFieldChange}
              placeholder="Isuzu NPR 2022"
              disabled={isPilot}
            />
          </label>

          <label>
            Estado
            <select
              name="estado"
              value={vehicleForm.estado}
              onChange={handleVehicleFieldChange}
              disabled={isPilot}
            >
              {VEHICLE_STATES.map((vehicleState) => (
                <option key={vehicleState} value={vehicleState}>
                  {vehicleState}
                </option>
              ))}
            </select>
          </label>

          <label>
            Kilometraje actual
            <input
              name="kilometraje_actual"
              type="number"
              min="0"
              step="0.01"
              value={vehicleForm.kilometraje_actual}
              onChange={handleKilometrajeChange}
              placeholder="0.00"
              required
              readOnly={isPilot}
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isVehicleSubmitting}>
            {isVehicleSubmitting
              ? 'Guardando...'
              : isPilot
                ? 'Actualizar kilometraje'
                : editingVehicleId
                ? 'Actualizar vehiculo'
                : 'Crear vehiculo'}
          </button>

          {editingVehicleId && !isPilot ? (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelVehicleEdit}
              disabled={isVehicleSubmitting}
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

      {vehiclesError ? <p className="feedback error">{vehiclesError}</p> : null}
      {vehiclesNotice ? <p className="feedback success">{vehiclesNotice}</p> : null}

      <div className="maturation-section-divider" aria-hidden="true" />

      <CollapsibleSection title="Listado de vehiculos" defaultCollapsed storageKey="module:collapsed:list:vehicles">
      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Estado</th>
              <th>Kilometraje</th>
              <th>Ult. modificacion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 && !isVehiclesLoading ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No hay vehiculos registrados.
                </td>
              </tr>
            ) : null}

            {vehicles.map((vehicle) => (
              <tr key={vehicle.id_vehiculo}>
                <td>{vehicle.placa || '-'}</td>
                <td>{vehicle.modelo || '-'}</td>
                <td>{vehicle.estado || '-'}</td>
                <td>{vehicle.kilometraje_actual ?? '-'}</td>
                <td>
                  {vehicle.fecha_modificacion
                    ? new Date(vehicle.fecha_modificacion).toLocaleString('es-GT')
                    : '-'}
                </td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleVehicleEdit(vehicle)}
                  >
                    {isPilot ? 'Editar km' : 'Editar'}
                  </button>
                  {!isPilot ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleVehicleDelete(vehicle.id_vehiculo)}
                    >
                      Eliminar
                    </button>
                  ) : null}
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

export default VehiclesModule
