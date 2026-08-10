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

export const listGreenNetsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/redes-verdes`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las redes de platano verde')
}

export const listGreenNetsBySublotRequest = async (sublotId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/redes-verdes/sublote/${sublotId}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las redes verdes del sub-lote')
}

export const createGreenNetRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/redes-verdes`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la red de platano verde')
}
