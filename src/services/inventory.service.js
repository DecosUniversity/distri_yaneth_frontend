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

export const listInventoryRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/inventario`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener inventario')
}

export const listExistenciasByProductRequest = async (idProducto, token) => {
  const response = await fetch(`${API_BASE_URL}/api/inventario/existencias?id_producto=${idProducto}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los lotes disponibles del producto')
}
export const getExpirationReportRequest = async (token, meses) => {
  const query = meses ? `?meses=${meses}` : ''
  const response = await fetch(`${API_BASE_URL}/api/inventario/caducidad${query}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el indicador de caducidad')
}

export const writeOffExpiredRequest = async (idExistencia, token) => {
  const response = await fetch(`${API_BASE_URL}/api/inventario/existencias/${idExistencia}/baja-vencimiento`, {
    method: 'POST',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo dar de baja la existencia vencida')
}
