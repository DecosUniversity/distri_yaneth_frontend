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

export const listMermaTypesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-merma`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los tipos de merma')
}

export const listProductionProcessesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los procesos de produccion')
}

export const getProductionProcessRequest = async (processId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el proceso de produccion')
}

export const createProductionProcessRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo iniciar el proceso de produccion')
}

export const addProductionStageRequest = async (processId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/etapas`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la etapa')
}

export const addProductionMermaRequest = async (processId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/mermas`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la merma')
}

export const addProductionInputRequest = async (processId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/insumos`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar el insumo')
}

export const addProductionColdRoomRequest = async (processId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/cuarto-frio`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar el ingreso a cuarto frio')
}

export const finalizeProductionProcessRequest = async (processId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/finalizar`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo finalizar el proceso de produccion')
}

export const deleteProductionProcessRequest = async (processId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar el proceso de produccion')
  }
}
