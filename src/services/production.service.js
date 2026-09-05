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

export const createMermaTypeRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-merma`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la categoria de merma')
}

export const updateMermaTypeRequest = async (id, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-merma/${id}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar la categoria de merma')
}

export const deleteMermaTypeRequest = async (id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-merma/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar la categoria de merma')
  }

  return true
}

export const listStageTypesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-etapa`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los tipos de etapa')
}

export const createStageTypeRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-etapa`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar el tipo de etapa')
}

export const updateStageTypeRequest = async (id, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-etapa/${id}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar el tipo de etapa')
}

export const deleteStageTypeRequest = async (id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/tipos-etapa/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar el tipo de etapa')
  }

  return true
}

export const listProductionOrdersRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/ordenes`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener las ordenes de produccion')
}

export const createProductionOrderRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/ordenes`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar la orden de produccion')
}

export const cancelProductionOrderRequest = async (id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/ordenes/${id}/cancelar`, {
    method: 'PUT',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo cancelar la orden de produccion')
}

export const listProductionProcessesRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los procesos de produccion')
}

export const getMermasPorCategoriaReportRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/reportes/mermas-por-categoria`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el reporte de mermas por categoria')
}

export const getProduccionPorProductoReportRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/reportes/produccion-por-producto`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el reporte de produccion por producto')
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

export const updateProductionStageRequest = async (processId, stageId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/etapas/${stageId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar la etapa')
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

export const revertProductionProcessRequest = async (processId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/produccion/procesos/${processId}/revertir`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload || {}),
  })

  return parseResponse(response, 'No se pudo revertir el proceso de produccion')
}
