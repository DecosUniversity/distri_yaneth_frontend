export const clearSession = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('authUser')
  sessionStorage.removeItem('authToken')
  sessionStorage.removeItem('authUser')
}

const parseJwtPayload = (token) => {
  try {
    const payload = token.split('.')[1]

    if (!payload) {
      return null
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = atob(padded)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const isTokenExpired = (token) => {
  if (!token) {
    return true
  }

  const payload = parseJwtPayload(token)
  const exp = payload?.exp

  if (!exp) {
    return false
  }

  return exp <= Math.floor(Date.now() / 1000)
}

export const getStoredSession = () => {
  const localToken = localStorage.getItem('authToken')
  const sessionToken = sessionStorage.getItem('authToken')
  const token = localToken || sessionToken

  if (!token) {
    return null
  }

  if (isTokenExpired(token)) {
    clearSession()
    return null
  }

  const rawUser = localToken
    ? localStorage.getItem('authUser')
    : sessionStorage.getItem('authUser')

  try {
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null,
    }
  } catch {
    return { token, user: null }
  }
}

export const persistSession = (response, remember) => {
  clearSession()

  const storage = remember ? localStorage : sessionStorage
  storage.setItem('authToken', response.token)
  storage.setItem('authUser', JSON.stringify(response.user))
}
