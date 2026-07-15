const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const buildHeaders = (token) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || fallbackMessage)
  }

  return data
}

export const listUsersRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener usuarios')
}

export const createUserRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear usuario')
}

export const resetUserPasswordRequest = async (userId, newPassword, token) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/reset-password`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify({ new_password: newPassword }),
  })

  return parseResponse(response, 'No se pudo restablecer la password')
}

export const deleteUserRequest = async (userId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar usuario')
  }
}