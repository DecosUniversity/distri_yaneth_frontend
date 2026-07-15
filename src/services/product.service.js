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

export const listProductsRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/productos`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener productos')
}

export const createProductRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/productos`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo crear producto')
}

export const updateProductRequest = async (productId, payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/productos/${productId}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo actualizar producto')
}

export const deleteProductRequest = async (productId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/productos/${productId}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'No se pudo eliminar producto')
  }
}
