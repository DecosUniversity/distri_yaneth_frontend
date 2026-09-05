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

export const searchTraceabilityRequest = async (q, token) => {
  const response = await fetch(`${API_BASE_URL}/api/trazabilidad/buscar?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo realizar la busqueda')
}

export const getTraceabilityByCodeRequest = async (codigo, token) => {
  const response = await fetch(`${API_BASE_URL}/api/trazabilidad?codigo=${encodeURIComponent(codigo)}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener la trazabilidad')
}

export const getTraceabilityByRefRequest = async (tipo, id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/trazabilidad?tipo=${encodeURIComponent(tipo)}&id=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener la trazabilidad')
}

export const searchTraceabilityByFiltersRequest = async ({ areas, desde, hasta }, token) => {
  const params = new URLSearchParams()

  if (areas && areas.length > 0) {
    params.set('areas', areas.join(','))
  }

  if (desde) {
    params.set('desde', desde)
  }

  if (hasta) {
    params.set('hasta', hasta)
  }

  const response = await fetch(`${API_BASE_URL}/api/trazabilidad/filtrar?${params.toString()}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo realizar la busqueda por filtros')
}
