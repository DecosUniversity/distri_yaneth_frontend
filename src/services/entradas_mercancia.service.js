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

export const listEntradasMercanciaRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener entradas de mercancia')
}

export const listExistenciasRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia/existencias`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener existencias')
}

export const createEntradaMercanciaRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la entrada')
}

export const deleteEntradaMercanciaRequest = async (entradaId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia/${entradaId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar la entrada')
  }
}

export const listUnitsByEntradaRequest = async (entradaId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia/${entradaId}/units`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las unidades de la entrada')
}

export const createUnitForEntradaRequest = async (entradaId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia/${entradaId}/units`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear la unidad')
}

export const deleteUnitRequest = async (unitId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/entradas-mercancia/units/${unitId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar la unidad')
  }
}