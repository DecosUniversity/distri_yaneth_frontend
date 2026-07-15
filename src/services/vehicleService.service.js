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

export const listVehicleServicesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/servicios-vehiculo`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener servicios de vehiculo')
}

export const createVehicleServiceRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/servicios-vehiculo`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear servicio de vehiculo')
}

export const updateVehicleServiceRequest = async (serviceId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/servicios-vehiculo/${serviceId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar servicio de vehiculo')
}

export const deleteVehicleServiceRequest = async (serviceId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/servicios-vehiculo/${serviceId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar servicio de vehiculo')
  }
}