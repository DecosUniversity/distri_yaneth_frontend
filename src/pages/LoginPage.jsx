import { useState } from 'react'

function LoginPage({ errorMessage, isSubmitting, onLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    remember: true,
  })

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target

    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onLogin(formData)
  }

  return (
    <main className="login-page">
      <section className="brand-panel" aria-label="Presentacion del sistema">
        <div className="badge">Gestion</div>
        <h1>Control inteligente para frutas y verduras</h1>
        <p>
          Administra inventario, clientes y proveedores desde un solo panel.
          Ingresa para continuar con la operacion diaria.
        </p>
        <ul className="highlights" aria-label="Beneficios principales">
          <li>Seguimiento de stock en tiempo real</li>
          <li>Orden y trazabilidad de productos frescos</li>
          <li>Datos centralizados para todo el equipo</li>
        </ul>
      </section>

      <section className="card-panel" aria-label="Formulario de login">
        <form className="login-card" onSubmit={handleSubmit}>
          <header>
            <h2>Iniciar sesion</h2>
            <p>Bienvenido de vuelta</p>
          </header>

          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Ingresa tu usuario"
            value={formData.username}
            onChange={handleInputChange}
            required
          />

          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Ingresa tu contrasena"
            value={formData.password}
            onChange={handleInputChange}
            required
          />

          <div className="row-options">
            <label className="remember" htmlFor="remember">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={formData.remember}
                onChange={handleInputChange}
              />
              Recordarme
            </label>
          </div>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Entrar al sistema'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
