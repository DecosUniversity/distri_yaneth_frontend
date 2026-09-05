import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { createMateriaPrimaEntry, acceptPendingLot, findSublotIdInTab, successMessage, toastMessage } from './helpers.js'

// La busqueda por numero en Trazabilidad es ambigua (entrada/lote/sub-lote pueden compartir el
// mismo id por coincidencia de autoincremento): si aparece una lista de resultados en vez del
// arbol directo, se elige el que corresponde exactamente al sub-lote buscado.
async function openSubloteTrace(page, subloteId) {
  await page.getByRole('button', { name: 'Trazabilidad', exact: true }).click()
  await page.getByPlaceholder(/Codigo de trazabilidad/).fill(subloteId)
  await page.getByRole('button', { name: 'Buscar' }).click()

  // .count() no espera a que React termine de pintar el resultado de la busqueda (es una
  // lectura inmediata, no una espera), asi que primero se espera a que aparezca la lista de
  // resultados o directamente el arbol de trazabilidad.
  const subloteResult = page.getByRole('button', { name: new RegExp(`Sub-lote #${subloteId}\\b`) })
  const traceTree = page.locator('.trace-tree')
  await expect(subloteResult.or(traceTree)).toBeVisible()

  if (await subloteResult.isVisible()) {
    await subloteResult.click()
  }
}

// Flujo de extremo a extremo del modulo de Distribucion: un pedido con entrega parcial genera
// una devolucion, y todo el recorrido (materia prima -> produccion -> pedido -> entrega ->
// devolucion) se puede rastrear desde Trazabilidad. Sigue la misma secuencia de reglas de
// negocio que Backend/tests/api/distribucion.api.test.js.
test.describe('Flujo de Distribucion: pedido -> entrega -> devolucion -> trazabilidad', () => {
  test.use({ storageState: authFile('Administrador') })

  test('un pedido con entrega parcial genera una devolucion rastreable en trazabilidad', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const clientName = `E2E Cliente Distribucion ${Date.now().toString(36)}`
    const vencimientoUnico = '2028-03-15'
    const productoNombre = 'Chips de Platano Bolsa 4 OZ'

    await page.goto('/')

    // --- Cliente nuevo, para que sus pedidos sean identificables sin ambiguedad ---
    await page.getByRole('button', { name: 'Clientes', exact: true }).click()
    await page.getByLabel('Nombre comercial *').fill(clientName)
    await page.getByRole('button', { name: 'Crear cliente' }).click()
    await expect(successMessage(page, 'Cliente creado correctamente')).toBeVisible()

    // --- Materia prima -> Maduracion (Maduro) -> Produccion -> finalizar con vencimiento unico ---
    const docRef = `E2E-DIST-${Date.now().toString(36)}`
    const entryId = await createMateriaPrimaEntry(page, docRef)
    const loteId = await acceptPendingLot(page, entryId, 'Maduro')
    const subloteId = await findSublotIdInTab(page, loteId, /Listos para produccion/)

    await page.getByRole('button', { name: 'Produccion', exact: true }).click()
    await page.getByLabel('Sub-lote listo para produccion *').selectOption({ value: subloteId })
    await page.getByLabel('Producto resultado *').selectOption({ label: productoNombre })
    await page.getByRole('button', { name: 'Iniciar proceso' }).click()
    await expect(successMessage(page, 'Proceso de produccion iniciado correctamente')).toBeVisible()

    const processRow = page.locator('table.providers-table tbody tr').filter({ hasText: `#${subloteId}` })
    await processRow.getByRole('button', { name: 'Gestionar' }).click()
    await page.getByRole('button', { name: 'Finalizar proceso' }).click()
    const finalizeModal = page.locator('.modal-backdrop').last()
    // Sin etapas ni mermas: 20kg ingresados deben cuadrar exactos con 20kg producidos.
    await finalizeModal.getByLabel('Cantidad producida (kg) *').fill('20')
    await finalizeModal.getByLabel('Fecha fin *').fill('2026-09-05T16:00')
    await finalizeModal.getByLabel('Fecha vencimiento *').fill(vencimientoUnico)
    await finalizeModal.getByRole('button', { name: 'Finalizar proceso' }).click()
    await expect(successMessage(page, 'finalizado correctamente')).toBeVisible()

    // --- Averiguar el id de la existencia recien creada via Trazabilidad (el vencimiento no ---
    // --- alcanza para identificarla si una corrida anterior dejo otra igual) ---
    await openSubloteTrace(page, subloteId)
    const existenciaTitle = page.getByText(new RegExp(`Existencia #\\d+ - ${productoNombre}`))
    const existenciaText = await existenciaTitle.textContent()
    const existenciaId = existenciaText.match(/Existencia #(\d+)/)[1]

    // --- Pedido: linea contra ese lote (existencia) exacto, para trazabilidad determinista ---
    await page.getByRole('button', { name: 'Pedidos', exact: true }).click()
    await page.getByRole('button', { name: 'Agregar pedido' }).click()
    const orderModal = page.locator('.modal-backdrop').last()
    await orderModal.getByLabel('Cliente *').selectOption({ label: clientName })
    await orderModal.getByLabel('Producto').selectOption({ label: productoNombre })
    await orderModal.getByLabel('Lote').selectOption(existenciaId)

    await orderModal.getByLabel('Cantidad').fill('5')
    await orderModal.getByRole('button', { name: 'Añadir linea' }).click()
    await orderModal.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(successMessage(page, 'Pedido registrado correctamente')).toBeVisible()

    const orderRow = page.locator('table.providers-table tbody tr').filter({ hasText: clientName })
    await expect(orderRow).toHaveCount(1)
    const orderIdText = (await orderRow.locator('td').first().textContent()).trim()

    // --- Entrega: crear ruta con ese pedido, vehiculo y piloto disponibles ---
    await page.getByRole('button', { name: 'Entregas', exact: true }).click()
    await page.getByRole('button', { name: 'Agregar entrega' }).click()
    const routeModal = page.locator('.modal-backdrop').last()

    const vehiculoSelect = routeModal.getByLabel('Vehiculo (Disponible) *')
    await vehiculoSelect.selectOption({ index: 1 })
    const vehiculoLabel = await vehiculoSelect.locator('option:checked').textContent()
    const vehiculoPlaca = vehiculoLabel.split(' - ')[0].trim()

    const pilotoSelect = routeModal.getByLabel('Piloto sugerido *')
    await pilotoSelect.selectOption({ index: 1 })
    const pilotoLabel = await pilotoSelect.locator('option:checked').textContent()
    const pilotoNombre = pilotoLabel.split(' (entregas hoy:')[0].trim()

    const pendingOrderRow = routeModal.locator('table.providers-table tbody tr').filter({ hasText: orderIdText })
    await expect(pendingOrderRow).toHaveCount(1)
    await pendingOrderRow.locator('input[type="checkbox"]').check()
    await routeModal.getByRole('button', { name: 'Crear entrega' }).click()
    await expect(successMessage(page, 'Entrega creada correctamente')).toBeVisible()

    const routeRow = page
      .locator('table.providers-table tbody tr')
      .filter({ hasText: vehiculoPlaca })
      .filter({ hasText: pilotoNombre })
    await expect(routeRow).toHaveCount(1)
    await routeRow.getByRole('button', { name: 'Gestionar' }).click()

    // --- Salida ---
    await page.getByRole('button', { name: 'Registrar salida' }).click()
    const salidaModal = page.locator('.modal-backdrop').last()
    await salidaModal.getByLabel('Km salida *').fill('10')
    await salidaModal.getByRole('button', { name: 'Registrar salida' }).click()
    await expect(toastMessage(page, 'Salida registrada correctamente')).toBeVisible()

    // --- Confirmar entregas: parcial (3 de 5), el resto queda pendiente de devolucion ---
    await page.getByRole('button', { name: 'Confirmar entregas' }).click()
    const entregasModal = page.locator('.modal-backdrop').last()
    await entregasModal.getByRole('button', { name: 'Marcar entrega' }).click()
    await entregasModal.locator('input[type="number"]').first().fill('3')
    await entregasModal.getByRole('button', { name: 'Guardar entregas' }).click()
    await expect(toastMessage(page, 'Entregas confirmadas correctamente')).toBeVisible()

    // --- Cerrar entrega ---
    await page.getByRole('button', { name: 'Cerrar entrega' }).click()
    const cerrarModal = page.locator('.modal-backdrop').last()
    await cerrarModal.getByLabel('Km llegada *').fill('15')
    await cerrarModal.getByRole('button', { name: 'Cerrar entrega' }).click()
    await expect(successMessage(page, 'cerrada correctamente')).toBeVisible()

    // --- Devolucion: recibir la linea no entregada (2 de 5) y reingresarla a inventario ---
    await page.getByRole('button', { name: 'Devoluciones', exact: true }).click()
    const pendingReceptionRow = page.locator('table.providers-table').first().locator('tbody tr').filter({ hasText: clientName })
    await expect(pendingReceptionRow).toHaveCount(1)
    await expect(pendingReceptionRow).toContainText('2.00')
    await pendingReceptionRow.getByRole('button', { name: 'Recibir' }).click()

    const receptionModal = page.locator('.modal-backdrop').last()
    await receptionModal.getByLabel('Motivo').fill('Cliente no recibio la totalidad del pedido')
    await receptionModal.getByRole('button', { name: 'Registrar recepcion' }).click()
    await expect(successMessage(page, 'Devolucion recibida correctamente')).toBeVisible()

    const pendingReviewTable = page.locator('table.providers-table').nth(1)
    const pendingReviewRow = pendingReviewTable.locator('tbody tr').filter({ hasText: productoNombre })
    await expect(pendingReviewRow).toHaveCount(1)
    await pendingReviewRow.getByRole('button', { name: 'Reingresar a inventario' }).click()
    await expect(successMessage(page, 'resuelta')).toBeVisible()
    await expect(pendingReviewTable.locator('tbody tr').filter({ hasText: productoNombre })).toHaveCount(0)

    // --- Trazabilidad: buscar por el sub-lote y verificar que el pedido aparece en el arbol ---
    await openSubloteTrace(page, subloteId)

    await expect(page.getByText(clientName)).toBeVisible()
    const pedidoTraceRow = page.locator('tr').filter({ hasText: clientName })
    // La linea pasa a "Devuelto" (estado terminal) una vez que la devolucion ya se resolvio,
    // en vez de quedarse en "Parcial".
    await expect(pedidoTraceRow).toContainText('Devuelto')
    await expect(pedidoTraceRow).toContainText('Con Devolucion')
  })
})
