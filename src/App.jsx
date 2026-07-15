import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { loginRequest } from './services/auth.service'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import { clearSession, getStoredSession, persistSession } from './utils/session'

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(getStoredSession)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleStorage = () => {
      setSession(getStoredSession())
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const handleLogin = async ({ username, password, remember }) => {
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const response = await loginRequest({ username, password })
      persistSession(response, remember)
      setSession({ token: response.token, user: response.user })
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo iniciar sesion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          session ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage
              errorMessage={errorMessage}
              isSubmitting={isSubmitting}
              onLogin={handleLogin}
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          session ? (
            <DashboardPage session={session} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

export default App
