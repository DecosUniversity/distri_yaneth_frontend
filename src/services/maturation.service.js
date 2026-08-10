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

export const acceptMaturationLotRequest = async (lotId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/lotes/${lotId}/aceptar`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo aceptar el lote para maduracion')
}

export const listSublotsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/sublotes`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los sub-lotes')
}

export const listReadyForProductionRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/sublotes/listos-para-produccion`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los sub-lotes listos para produccion')
}

export const splitSublotRequest = async (sublotId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/sublotes/${sublotId}/fraccionar`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo fraccionar el sub-lote')
}

export const closeSublotRequest = async (sublotId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/sublotes/${sublotId}/cerrar`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo cerrar la maduracion del sub-lote')
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

export const createGreenNetRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/redes-verdes`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la red de platano verde')
}

export const listGreenNetsBySublotRequest = async (sublotId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/maduracion/redes-verdes/sublote/${sublotId}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las redes verdes del sub-lote')
}
