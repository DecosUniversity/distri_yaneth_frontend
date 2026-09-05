import { useEffect, useState } from 'react'
import {
  createClientRequest,
  deleteClientRequest,
  listClientsRequest,
  updateClientRequest,
} from '../../services/client.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const GUATEMALA_DEPARTMENTS = [
  'Alta Verapaz',
  'Baja Verapaz',
  'Chimaltenango',
  'Chiquimula',
  'El Progreso',
  'Escuintla',
  'Guatemala',
  'Huehuetenango',
  'Izabal',
  'Jalapa',
  'Jutiapa',
  'Petén',
  'Quetzaltenango',
  'Quiché',
  'Retalhuleu',
  'Sacatepéquez',
  'San Marcos',
  'Santa Rosa',
  'Sololá',
  'Suchitepéquez',
  'Totonicapán',
  'Zacapa',
]

const EMPTY_CLIENT_FORM = {
  nombre_comercial: '',
  departamento: '',
  municipio: '',
  zona: '',
  direccion_entrega: '',
  telefono: '',
  nit_facturacion: '',
}

const normalizeClientPayload = (clientForm) => ({
  nombre_comercial: clientForm.nombre_comercial.trim(),
  departamento: clientForm.departamento || undefined,
  municipio: clientForm.municipio.trim() || undefined,
  zona: clientForm.zona.trim() || undefined,
  direccion_entrega: clientForm.direccion_entrega.trim() || undefined,
  telefono: clientForm.telefono.trim() || undefined,
  nit_facturacion: clientForm.nit_facturacion.trim() || undefined,
})

const formatUbicacion = (client) => {
  const parts = []

  if (client.zona) {
    parts.push(`Zona ${client.zona}`)
  }

  if (client.municipio) {
    parts.push(client.municipio)
  }

  if (client.departamento) {
    parts.push(client.departamento)
  }

  return parts.length > 0 ? parts.join(', ') : '-'
}

function ClientsModule({ token, isActive }) {
  const [clients, setClients] = useState([])
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM)
  const [editingClientId, setEditingClientId] = useState(null)
  const [isClientsLoading, setIsClientsLoading] = useState(false)
  const [isClientSubmitting, setIsClientSubmitting] = useState(false)
  const [clientsError, setClientsError] = useState('')
  const [clientsNotice, setClientsNotice] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadClients = async () => {
    setClientsError('')
    setIsClientsLoading(true)

    try {
      const data = await listClientsRequest(token)
      setClients(Array.isArray(data) ? data : [])
    } catch (error) {
      setClientsError(error.message || 'No se pudo cargar clientes')
    } finally {
      setIsClientsLoading(false)
    }
  }

  const handleClientFieldChange = (event) => {
    const { name, value } = event.target
    setClientForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleClientSubmit = async (event) => {
    event.preventDefault()
    setClientsError('')
    setClientsNotice('')
    setIsClientSubmitting(true)

    try {
      const payload = normalizeClientPayload(clientForm)

      if (editingClientId) {
        await updateClientRequest(editingClientId, payload, token)
        setClientsNotice('Cliente actualizado correctamente')
        notifySuccess('Cliente actualizado correctamente')
      } else {
        await createClientRequest(payload, token)
        setClientsNotice('Cliente creado correctamente')
        notifySuccess('Cliente creado correctamente')
      }

      setClientForm(EMPTY_CLIENT_FORM)
      setEditingClientId(null)
      await loadClients()
    } catch (error) {
      const message = error.message || 'No se pudo guardar cliente'
      setClientsError(message)
      notifyError(message)
    } finally {
      setIsClientSubmitting(false)
    }
  }

  const handleClientEdit = (client) => {
    setEditingClientId(client.id_cliente)
    setClientForm({
      nombre_comercial: client.nombre_comercial || '',
      departamento: client.departamento || '',
      municipio: client.municipio || '',
      zona: client.zona || '',
      direccion_entrega: client.direccion_entrega || '',
      telefono: client.telefono || '',
      nit_facturacion: client.nit_facturacion || '',
    })
    setClientsNotice('')
    setClientsError('')
  }

  const cancelClientEdit = () => {
    setEditingClientId(null)
    setClientForm(EMPTY_CLIENT_FORM)
    setClientsNotice('')
  }

  const handleClientDelete = async (clientId) => {
    const confirmDelete = window.confirm(
      'Esta accion eliminara el cliente seleccionado. Deseas continuar?'
    )

    if (!confirmDelete) {
      return
    }

    setClientsError('')
    setClientsNotice('')

    try {
      await deleteClientRequest(clientId, token)
      setClientsNotice('Cliente eliminado correctamente')
      notifySuccess('Cliente eliminado correctamente')
      await loadClients()

      if (editingClientId === clientId) {
        cancelClientEdit()
      }
    } catch (error) {
      const message = error.message || 'No se pudo eliminar cliente'
      setClientsError(message)
      notifyError(message)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de clientes">
      <ReloadButton onClick={loadClients} isLoading={isClientsLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Modulo Clientes</h3>
          <p>Gestion de clientes con ubicacion por departamento, municipio y zona, telefono y NIT de facturacion.</p>
        </div>
      </div>

      <form className="provider-form" onSubmit={handleClientSubmit}>
        <div className="provider-form-grid">
          <label>
            Nombre comercial *
            <input
              name="nombre_comercial"
              type="text"
              value={clientForm.nombre_comercial}
              onChange={handleClientFieldChange}
              placeholder="Nombre comercial"
              required
            />
          </label>

          <label>
            Telefono
            <input
              name="telefono"
              type="text"
              minLength="8"
              maxLength="11"
              value={clientForm.telefono}
              onChange={handleClientFieldChange}
              placeholder="Telefono"
            />
          </label>

          <label>
            NIT facturacion
            <input
              name="nit_facturacion"
              type="text"
              value={clientForm.nit_facturacion}
              onChange={handleClientFieldChange}
              placeholder="NIT facturacion"
            />
          </label>

          <label>
            Departamento
            <select name="departamento" value={clientForm.departamento} onChange={handleClientFieldChange}>
              <option value="">Selecciona departamento</option>
              {GUATEMALA_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>

          <label>
            Municipio
            <input
              name="municipio"
              type="text"
              value={clientForm.municipio}
              onChange={handleClientFieldChange}
              placeholder="Municipio"
            />
          </label>

          <label>
            Zona
            <input
              name="zona"
              type="text"
              value={clientForm.zona}
              onChange={handleClientFieldChange}
              placeholder="Ej. 5"
            />
          </label>

          <label className="full-width-field">
            Direccion detallada
            <input
              name="direccion_entrega"
              type="text"
              value={clientForm.direccion_entrega}
              onChange={handleClientFieldChange}
              placeholder="Calle, avenida, numero de casa, referencia"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isClientSubmitting}>
            {isClientSubmitting
              ? 'Guardando...'
              : editingClientId
                ? 'Actualizar cliente'
                : 'Crear cliente'}
          </button>

          {editingClientId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelClientEdit}
              disabled={isClientSubmitting}
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

      {clientsError ? <p className="feedback error">{clientsError}</p> : null}
      {clientsNotice ? <p className="feedback success">{clientsNotice}</p> : null}

      <div className="maturation-section-divider" aria-hidden="true" />

      <CollapsibleSection title="Listado de clientes" defaultCollapsed storageKey="module:collapsed:list:clients">
      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Nombre comercial</th>
              <th>Ubicacion</th>
              <th>Direccion</th>
              <th>Telefono</th>
              <th>NIT</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && !isClientsLoading ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No hay clientes registrados.
                </td>
              </tr>
            ) : null}

            {clients.map((client) => (
              <tr key={client.id_cliente}>
                <td>{client.nombre_comercial || '-'}</td>
                <td>{formatUbicacion(client)}</td>
                <td>{client.direccion_entrega || '-'}</td>
                <td>{client.telefono || '-'}</td>
                <td>{client.nit_facturacion || '-'}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleClientEdit(client)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleClientDelete(client.id_cliente)}
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

export default ClientsModule