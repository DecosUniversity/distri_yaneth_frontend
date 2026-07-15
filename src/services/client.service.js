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

export const listClientsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/clientes`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener clientes')
}

export const createClientRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/clientes`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear cliente')
}

export const updateClientRequest = async (clientId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/clientes/${clientId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar cliente')
}

export const deleteClientRequest = async (clientId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/clientes/${clientId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar cliente')
  }
}