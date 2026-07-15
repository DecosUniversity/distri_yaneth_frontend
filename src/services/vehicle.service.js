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

export const listVehiclesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/vehiculos`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener vehiculos')
}

export const createVehicleRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/vehiculos`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear vehiculo')
}

export const updateVehicleRequest = async (vehicleId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/vehiculos/${vehicleId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar vehiculo')
}

export const deleteVehicleRequest = async (vehicleId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/vehiculos/${vehicleId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar vehiculo')
  }
}
