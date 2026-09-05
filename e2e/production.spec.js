import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { createMateriaPrimaEntry, acceptPendingLot, findSublotIdInTab, successMessage } from './helpers.js'

test.describe('Modulo Produccion', () => {
  test.use({ storageState: authFile('Administrador') })

  test('inicia un proceso, agrega etapa y merma, y lo finaliza cuadrando el balance', async ({ page }) => {
    const docRef = `E2E-PROD-${Date.now().toString(36)}`

    await page.goto('/')
    const entryId = await createMateriaPrimaEntry(page, docRef)
    // "Maduro" pasa directo a Listo para produccion, que es lo que exige el modulo de Produccion
    const loteId = await acceptPendingLot(page, entryId, 'Maduro')
    const subloteId = await findSublotIdInTab(page, loteId, /Listos para produccion/)

    await page.getByRole('button', { name: 'Produccion', exact: true }).click()

    await page.getByLabel('Sub-lote listo para produccion *').selectOption({ value: subloteId })
    await page.getByLabel('Producto resultado *').selectOption({ label: 'Tostones Congelados Bolsa 2 LBS' })
    await page.getByRole('button', { name: 'Iniciar proceso' }).click()
    await expect(successMessage(page, 'Proceso de produccion iniciado correctamente')).toBeVisible()

    const processTable = page.locator('table.providers-table')
    const processRow = processTable.locator('tbody tr').filter({ hasText: `#${subloteId}` })
    await expect(processRow).toHaveCount(1)
    await processRow.getByRole('button', { name: 'Gestionar' }).click()

    // Agregar etapa (entrada/fecha ya vienen prellenadas: se toman del proceso)
    await page.getByRole('button', { name: 'Agregar etapa' }).click()
    const stageModal = page.locator('.modal-backdrop').last()
    await stageModal.getByLabel('Etapa *').selectOption({ index: 1 })
    await stageModal.getByLabel('Cantidad de personas *').fill('2')
    await stageModal.getByRole('button', { name: 'Iniciar etapa' }).click()
    await expect(successMessage(page, 'Etapa iniciada correctamente')).toBeVisible()

    // Agregar merma ligada a esa etapa (boton dentro de la fila de la etapa, no el general)
    const stageRow = page.locator('table.providers-table tbody tr').filter({
      has: page.getByRole('button', { name: 'Agregar merma' }),
    })
    await expect(stageRow).toHaveCount(1)
    await stageRow.getByRole('button', { name: 'Agregar merma' }).click()
    const mermaModal = page.locator('.modal-backdrop').last()
    await mermaModal.getByLabel('Categoria *').selectOption({ index: 1 })
    await mermaModal.getByLabel('Cantidad (kg)').fill('5')
    await mermaModal.getByRole('button', { name: 'Registrar merma' }).click()
    await expect(successMessage(page, 'Merma registrada correctamente')).toBeVisible()

    // Finalizar la etapa (entrada 20kg - merma 5kg = salida 15kg)
    const stageRowAfterMerma = page.locator('table.providers-table tbody tr').filter({
      has: page.getByRole('button', { name: 'Finalizar' }),
    })
    await stageRowAfterMerma.getByRole('button', { name: 'Finalizar' }).click()
    const stageEditModal = page.locator('.modal-backdrop').last()
    await stageEditModal.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(successMessage(page, 'Etapa actualizada correctamente')).toBeVisible()

    // Finalizar el proceso completo: 20kg ingresados - 5kg merma = 15kg esperados
    await page.getByRole('button', { name: 'Finalizar proceso' }).click()
    const finalizeModal = page.locator('.modal-backdrop').last()
    await finalizeModal.getByLabel('Cantidad producida (kg) *').fill('15')
    await finalizeModal.getByLabel('Fecha fin *').fill('2026-09-05T15:00')
    await finalizeModal.getByLabel('Fecha vencimiento *').fill('2027-01-01')
    await finalizeModal.getByRole('button', { name: 'Finalizar proceso' }).click()
    await expect(successMessage(page, 'finalizado correctamente')).toBeVisible()

    // Verificar en "Consultar" > "Finalizados"
    await page.getByRole('tab', { name: 'Consultar' }).click()
    await page.getByRole('button', { name: /Finalizados/ }).click()
    await page.getByPlaceholder('#proceso o #lote').fill(subloteId)
    const finishedRow = page.locator('table.providers-table tbody tr').filter({ hasText: `#${subloteId}` })
    await expect(finishedRow).toHaveCount(1)
    await expect(finishedRow).toContainText('Tostones Congelados Bolsa 2 LBS')
    await expect(finishedRow).toContainText('Finalizado')
  })

  test('crea y cancela una orden de produccion', async ({ page }) => {
    // Las ordenes nunca se borran (solo se cancelan), asi que una cantidad fija como "12.34"
    // podria coincidir con una orden ya cancelada de una corrida anterior. Se usa una cantidad
    // derivada del timestamp (menor a 1000 para que Intl no le agregue separador de miles) para
    // que la fila sea identificable de forma unica de principio a fin.
    const cantidadSolicitada = Number(String(Date.now()).slice(-3)).toFixed(2)

    await page.goto('/')
    await page.getByRole('button', { name: 'Produccion', exact: true }).click()
    await page.getByRole('tab', { name: 'Ordenes de produccion' }).click()

    await page.getByLabel('Producto terminado *').selectOption({ label: 'Chips de Platano Bolsa 4 OZ' })
    await page.getByLabel('Cantidad solicitada (kg) *').fill(cantidadSolicitada)
    await page.getByRole('button', { name: 'Crear orden' }).click()
    await expect(successMessage(page, 'Orden de produccion creada correctamente')).toBeVisible()

    const ordersTable = page.locator('table.providers-table')
    const orderRow = ordersTable.locator('tbody tr').filter({ hasText: cantidadSolicitada })
    await expect(orderRow).toHaveCount(1)
    await expect(orderRow).toContainText('Pendiente')

    await orderRow.getByRole('button', { name: 'Cancelar' }).click()
    await expect(successMessage(page, 'cancelada')).toBeVisible()
    await expect(orderRow).toContainText('Cancelada')
    await expect(orderRow.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  })
})
