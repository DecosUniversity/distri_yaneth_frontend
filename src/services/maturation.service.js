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

export const listMaturationLotsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/lotes`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener lotes de materia prima')
}

export const createMaturationLotRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/lotes`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear lote de materia prima')
}

export const updateMaturationLotRequest = async (lotId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/lotes/${lotId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar lote de materia prima')
}

export const deleteMaturationLotRequest = async (lotId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/lotes/${lotId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar lote de materia prima')
  }
}

export const listMaturationControlsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/controles`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener controles de maduracion')
}

export const createMaturationControlRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/controles`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear control de maduracion')
}

export const deleteMaturationControlRequest = async (controlId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/controles/${controlId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar control de maduracion')
  }
}
