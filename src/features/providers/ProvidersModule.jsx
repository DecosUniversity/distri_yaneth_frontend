import { useEffect, useState } from 'react'
import {
  createProviderRequest,
  deleteProviderRequest,
  listProvidersRequest,
  updateProviderRequest,
} from '../../services/provider.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const EMPTY_PROVIDER_FORM = {
  nombre_empresa: '',
  nit: '',
  contacto_nombre: '',
  telefono: '',
}

function ProvidersModule({ token, isActive }) {
  const [providers, setProviders] = useState([])
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER_FORM)
  const [editingProviderId, setEditingProviderId] = useState(null)
  const [isProvidersLoading, setIsProvidersLoading] = useState(false)
  const [isProviderSubmitting, setIsProviderSubmitting] = useState(false)
  const [providersError, setProvidersError] = useState('')
  const [providersNotice, setProvidersNotice] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadProviders = async () => {
    setProvidersError('')
    setIsProvidersLoading(true)

    try {
      const data = await listProvidersRequest(token)
      setProviders(Array.isArray(data) ? data : [])
    } catch (error) {
      setProvidersError(error.message || 'No se pudo cargar proveedores')
    } finally {
      setIsProvidersLoading(false)
    }
  }

  const handleProviderFieldChange = (event) => {
    const { name, value } = event.target
    setProviderForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleProviderSubmit = async (event) => {
    event.preventDefault()
    setProvidersError('')
    setProvidersNotice('')
    setIsProviderSubmitting(true)

    try {
      if (editingProviderId) {
        await updateProviderRequest(editingProviderId, providerForm, token)
        setProvidersNotice('Proveedor actualizado correctamente')
        notifySuccess('Proveedor actualizado correctamente')
      } else {
        await createProviderRequest(providerForm, token)
        setProvidersNotice('Proveedor creado correctamente')
        notifySuccess('Proveedor creado correctamente')
      }

      setProviderForm(EMPTY_PROVIDER_FORM)
      setEditingProviderId(null)
      await loadProviders()
    } catch (error) {
      const message = error.message || 'No se pudo guardar proveedor'
      setProvidersError(message)
      notifyError(message)
    } finally {
      setIsProviderSubmitting(false)
    }
  }

  const handleProviderEdit = (provider) => {
    setEditingProviderId(provider.id_proveedor)
    setProviderForm({
      nombre_empresa: provider.nombre_empresa || '',
      nit: provider.nit || '',
      contacto_nombre: provider.contacto_nombre || '',
      telefono: provider.telefono || '',
    })
    setProvidersNotice('')
    setProvidersError('')
  }

  const cancelProviderEdit = () => {
    setEditingProviderId(null)
    setProviderForm(EMPTY_PROVIDER_FORM)
    setProvidersNotice('')
  }

  const handleProviderDelete = async (providerId) => {
    const confirmDelete = window.confirm(
      'Esta accion eliminara el proveedor seleccionado. Deseas continuar?'
    )

    if (!confirmDelete) {
      return
    }

    setProvidersError('')
    setProvidersNotice('')

    try {
      await deleteProviderRequest(providerId, token)
      setProvidersNotice('Proveedor eliminado correctamente')
      notifySuccess('Proveedor eliminado correctamente')
      await loadProviders()

      if (editingProviderId === providerId) {
        cancelProviderEdit()
      }
    } catch (error) {
      const message = error.message || 'No se pudo eliminar proveedor'
      setProvidersError(message)
      notifyError(message)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de proveedores">
      <ReloadButton onClick={loadProviders} isLoading={isProvidersLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Modulo Proveedores</h3>
          <p>Gestion de altas, ediciones, consultas y eliminaciones.</p>
        </div>
      </div>

      <form className="provider-form" onSubmit={handleProviderSubmit}>
        <div className="provider-form-grid">
          <label>
            Empresa *
            <input
              name="nombre_empresa"
              type="text"
              value={providerForm.nombre_empresa}
              onChange={handleProviderFieldChange}
              placeholder="Nombre de empresa"
              required
            />
          </label>

          <label>
            NIT
            <input
              name="nit"
              type="text"
              value={providerForm.nit}
              onChange={handleProviderFieldChange}
              placeholder="NIT"
            />
          </label>

          <label>
            Contacto
            <input
              name="contacto_nombre"
              type="text"
              value={providerForm.contacto_nombre}
              onChange={handleProviderFieldChange}
              placeholder="Nombre de contacto"
            />
          </label>

          <label>
            Telefono
            <input
              name="telefono"
              type="text"
              minLength="8"
              maxLength="11"
              value={providerForm.telefono}
              onChange={handleProviderFieldChange}
              placeholder="Telefono"
            />
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isProviderSubmitting}>
            {isProviderSubmitting
              ? 'Guardando...'
              : editingProviderId
                ? 'Actualizar proveedor'
                : 'Crear proveedor'}
          </button>

          {editingProviderId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelProviderEdit}
              disabled={isProviderSubmitting}
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

      {providersError ? <p className="feedback error">{providersError}</p> : null}
      {providersNotice ? <p className="feedback success">{providersNotice}</p> : null}

      <div className="maturation-section-divider" aria-hidden="true" />

      <CollapsibleSection title="Listado de proveedores" defaultCollapsed storageKey="module:collapsed:list:providers">
      <div className="providers-table-wrap">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>NIT</th>
              <th>Contacto</th>
              <th>Telefono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 && !isProvidersLoading ? (
              <tr>
                <td colSpan="5" className="empty-table-cell">
                  No hay proveedores registrados.
                </td>
              </tr>
            ) : null}

            {providers.map((provider) => (
              <tr key={provider.id_proveedor}>
                <td>{provider.nombre_empresa || '-'}</td>
                <td>{provider.nit || '-'}</td>
                <td>{provider.contacto_nombre || '-'}</td>
                <td>{provider.telefono || '-'}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleProviderEdit(provider)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleProviderDelete(provider.id_proveedor)}
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

export default ProvidersModule
