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

export const listServiceTypesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/tipos-servicio`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener tipos de servicio')
}

export const createServiceTypeRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/tipos-servicio`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear tipo de servicio')
}

export const updateServiceTypeRequest = async (serviceTypeId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/tipos-servicio/${serviceTypeId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar tipo de servicio')
}

export const deleteServiceTypeRequest = async (serviceTypeId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/tipos-servicio/${serviceTypeId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar tipo de servicio')
  }
}
