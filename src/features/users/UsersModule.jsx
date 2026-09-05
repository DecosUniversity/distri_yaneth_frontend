import { useEffect, useState } from 'react'
import {
  createUserRequest,
  deleteUserRequest,
  listUsersRequest,
  resetUserPasswordRequest,
} from '../../services/user.service'
import CollapsibleSection from '../../components/dashboard/CollapsibleSection'
import ReloadButton from '../../components/common/ReloadButton'
import { notifyError, notifySuccess } from '../../utils/toast'

const ROLE_OPTIONS = ['Administrador', 'Produccion', 'Logistica', 'Piloto']

const EMPTY_USER_FORM = {
  nombre_completo: '',
  username: '',
  password: '',
  rol: 'Piloto',
}

function UsersModule({ token, isActive }) {
  const [users, setUsers] = useState([])
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [isUserSubmitting, setIsUserSubmitting] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [usersNotice, setUsersNotice] = useState('')

  useEffect(() => {
    if (!isActive) {
      return
    }

    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, token])

  const loadUsers = async () => {
    setUsersError('')
    setIsUsersLoading(true)

    try {
      const data = await listUsersRequest(token)
      setUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      setUsersError(error.message || 'No se pudo cargar usuarios')
    } finally {
      setIsUsersLoading(false)
    }
  }

  const handleUserFieldChange = (event) => {
    const { name, value } = event.target
    setUserForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleUserSubmit = async (event) => {
    event.preventDefault()
    setUsersError('')
    setUsersNotice('')
    setIsUserSubmitting(true)

    try {
      await createUserRequest(userForm, token)
      setUsersNotice('Usuario creado correctamente')
      notifySuccess('Usuario creado correctamente')
      setUserForm(EMPTY_USER_FORM)
      await loadUsers()
    } catch (error) {
      const message = error.message || 'No se pudo crear usuario'
      setUsersError(message)
      notifyError(message)
    } finally {
      setIsUserSubmitting(false)
    }
  }

  const handleResetPassword = async (user) => {
    const newPassword = window.prompt(`Nueva password para ${user.username}:`)

    if (!newPassword) {
      return
    }

    setUsersError('')
    setUsersNotice('')

    try {
      await resetUserPasswordRequest(user.id_usuario, newPassword, token)
      setUsersNotice(`Password restablecida para ${user.username}`)
      notifySuccess(`Password restablecida para ${user.username}`)
    } catch (error) {
      const message = error.message || 'No se pudo restablecer password'
      setUsersError(message)
      notifyError(message)
    }
  }

  const handleDeleteUser = async (user) => {
    const confirmDelete = window.confirm(
      `Esta accion eliminara el usuario ${user.username}. Deseas continuar?`
    )

    if (!confirmDelete) {
      return
    }

    setUsersError('')
    setUsersNotice('')

    try {
      await deleteUserRequest(user.id_usuario, token)
      setUsersNotice('Usuario eliminado correctamente')
      notifySuccess('Usuario eliminado correctamente')
      await loadUsers()
    } catch (error) {
      const message = error.message || 'No se pudo eliminar usuario'
      setUsersError(message)
      notifyError(message)
    }
  }

  return (
    <section className="panel-card" aria-label="Modulo de usuarios">
      <ReloadButton onClick={loadUsers} isLoading={isUsersLoading} />
      <div className="providers-header-row has-reload-button">
        <div>
          <h3>Modulo Usuarios</h3>
          <p>Crear, eliminar y restablecer password de usuarios del sistema.</p>
        </div>
      </div>

      <form className="provider-form" onSubmit={handleUserSubmit}>
        <div className="provider-form-grid">
          <label>
            Nombre completo *
            <input
              name="nombre_completo"
              type="text"
              value={userForm.nombre_completo}
              onChange={handleUserFieldChange}
              placeholder="Nombre completo"
              required
            />
          </label>

          <label>
            Username *
            <input
              name="username"
              type="text"
              value={userForm.username}
              onChange={handleUserFieldChange}
              placeholder="usuario"
              required
            />
          </label>

          <label>
            Password inicial *
            <input
              name="password"
              type="password"
              value={userForm.password}
              onChange={handleUserFieldChange}
              placeholder="Minimo 6 caracteres"
              minLength={6}
              required
            />
          </label>

          <label>
            Rol *
            <select name="rol" value={userForm.rol} onChange={handleUserFieldChange} required>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="provider-form-actions">
          <button type="submit" disabled={isUserSubmitting}>
            {isUserSubmitting ? 'Guardando...' : 'Crear usuario'}
          </button>
        </div>
      </form>

      {usersError ? <p className="feedback error">{usersError}</p> : null}
      {usersNotice ? <p className="feedback success">{usersNotice}</p> : null}

      <div className="maturation-section-divider" aria-hidden="true" />

      <CollapsibleSection title="Listado de usuarios" defaultCollapsed storageKey="module:collapsed:list:users">
      <div className="providers-table-wrap table-limited">
        <table className="providers-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Username</th>
              <th>Rol</th>
              <th>Fecha creacion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !isUsersLoading ? (
              <tr>
                <td colSpan="5" className="empty-table-cell">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : null}

            {users.map((user) => (
              <tr key={user.id_usuario}>
                <td>{user.nombre_completo || '-'}</td>
                <td>{user.username || '-'}</td>
                <td>{user.rol || '-'}</td>
                <td>{user.fecha_creacion ? new Date(user.fecha_creacion).toLocaleString('es-GT') : '-'}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleResetPassword(user)}
                  >
                    Contraseña
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDeleteUser(user)}
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

export default UsersModule