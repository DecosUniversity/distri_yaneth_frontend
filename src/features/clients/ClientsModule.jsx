import { useEffect, useState } from 'react'
import {
  createClientRequest,
  deleteClientRequest,
  listClientsRequest,
  updateClientRequest,
} from '../../services/client.service'

const EMPTY_CLIENT_FORM = {
  nombre_comercial: '',
  direccion_entrega: '',
  telefono: '',
  nit_facturacion: '',
}

const normalizeClientPayload = (clientForm) => ({
  nombre_comercial: clientForm.nombre_comercial.trim(),
  direccion_entrega: clientForm.direccion_entrega.trim() || undefined,
  telefono: clientForm.telefono.trim() || undefined,
  nit_facturacion: clientForm.nit_facturacion.trim() || undefined,
})

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
      } else {
        await createClientRequest(payload, token)
        setClientsNotice('Cliente creado correctamente')
      }

      setClientForm(EMPTY_CLIENT_FORM)
      setEditingClientId(null)
      await loadClients()
    } catch (error) {
      setClientsError(error.message || 'No se pudo guardar cliente')
    } finally {
      setIsClientSubmitting(false)
    }
  }

  const handleClientEdit = (client) => {
    setEditingClientId(client.id_cliente)
    setClientForm({
      nombre_comercial: client.nombre_comercial || '',
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
      await loadClients()

      if (editingClientId === clientId) {
        cancelClientEdit()
      }
    } catch (error) {
      setClientsError(error.message || 'No se pudo eliminar cliente')
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de clientes">
      <div className="providers-header-row">
        <div>
          <h3>Modulo Clientes</h3>
          <p>Gestion de clientes con direccion de entrega, telefono y NIT de facturacion.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={loadClients}
          disabled={isClientsLoading}
        >
          {isClientsLoading ? 'Actualizando...' : 'Recargar'}
        </button>
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

          <label className="full-width-field">
            Direccion de entrega
            <input
              name="direccion_entrega"
              type="text"
              value={clientForm.direccion_entrega}
              onChange={handleClientFieldChange}
              placeholder="Direccion de entrega"
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

      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Nombre comercial</th>
              <th>Direccion</th>
              <th>Telefono</th>
              <th>NIT</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && !isClientsLoading ? (
              <tr>
                <td colSpan="5" className="empty-table-cell">
                  No hay clientes registrados.
                </td>
              </tr>
            ) : null}

            {clients.map((client) => (
              <tr key={client.id_cliente}>
                <td>{client.nombre_comercial || '-'}</td>
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
    </section>
  )
}

export default ClientsModule