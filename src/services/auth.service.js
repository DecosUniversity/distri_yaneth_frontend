const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const loginRequest = async ({ username, password }) => {
  const response = await fetch(`${API_BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Credenciales invalidas')
  }

  return data
}
