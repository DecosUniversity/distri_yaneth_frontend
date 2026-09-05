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

export const listOrdersRequest = async (token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudieron obtener los pedidos')
}

export const getOrderRequest = async (id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos/${id}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el pedido')
}

export const createOrderRequest = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })

  return parseResponse(response, 'No se pudo registrar el pedido')
}

export const cancelOrderRequest = async (id, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos/${id}/cancelar`, {
    method: 'PUT',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo cancelar el pedido')
}

export const updateOrderFechaEntregaRequest = async (id, fecha_entrega_programada, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos/${id}/fecha-entrega`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify({ fecha_entrega_programada }),
  })

  return parseResponse(response, 'No se pudo actualizar la fecha de entrega')
}

const buildQueryString = (params) => {
  const search = new URLSearchParams()

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, value)
    }
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

export const getProductosMasVendidosReportRequest = async ({ desde, hasta, id_cliente } = {}, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos/reportes/mas-vendidos${buildQueryString({ desde, hasta, id_cliente })}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el reporte de productos mas vendidos')
}

export const getMejoresClientesReportRequest = async ({ desde, hasta } = {}, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos/reportes/mejores-clientes${buildQueryString({ desde, hasta })}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el reporte de mejores clientes')
}

export const getPedidosDelDiaReportRequest = async ({ fecha } = {}, token) => {
  const response = await fetch(`${API_BASE_URL}/api/pedidos/reportes/pedidos-del-dia${buildQueryString({ fecha })}`, {
    method: 'GET',
    headers: buildHeaders(token),
  })

  return parseResponse(response, 'No se pudo obtener el reporte de pedidos del dia')
}
