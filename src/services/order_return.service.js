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

export const listOrderReturnsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/devoluciones`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las devoluciones')
}

export const listPendingReviewReturnsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/devoluciones/pendientes-revision`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las devoluciones pendientes de revision')
}

export const listPendingReceptionLinesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/devoluciones/pendientes-recepcion`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las lineas pendientes de recepcion')
}

export const createOrderReturnRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/devoluciones`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la recepcion de la devolucion')
}

export const resolveOrderReturnRequest = async (id, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/devoluciones/${id}/resolver`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo resolver la devolucion')
}
