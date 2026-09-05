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

export const listRoutesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las rutas')
}

export const getRouteRequest = async (id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas/${id}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener la ruta')
}

export const listAvailablePilotsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas/pilotos-disponibles`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los pilotos disponibles')
}

export const createRouteRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear la ruta')
}

export const registerRouteDepartureRequest = async (id, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas/${id}/salida`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la salida de la ruta')
}

export const confirmRouteDeliveriesRequest = async (id, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas/${id}/entregas`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudieron confirmar las entregas')
}

export const closeRouteRequest = async (id, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/rutas/${id}/cerrar`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo cerrar la ruta')
}
