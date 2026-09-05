import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { createMateriaPrimaEntry, acceptPendingLot, successMessage } from './helpers.js'

test.describe('Modulo Redes verdes - empaque de sub-lote', () => {
  test.use({ storageState: authFile('Administrador') })

  test('empaca un sub-lote verde disponible en una caja de redes', async ({ page }) => {
    const docRef = `E2E-RED-${Date.now().toString(36)}`

    await page.goto('/')
    const entryId = await createMateriaPrimaEntry(page, docRef)
    // "Verde" (el default) deja el sub-lote Activo, que es el unico estado que Redes acepta
    const loteId = await acceptPendingLot(page, entryId, 'Verde')

    // El sub-lote recien creado ya esta en la pestana "Activos" (seleccionada por defecto)
    const activeSublotsTable = page.locator('table.providers-table').last()
    const subRow = activeSublotsTable.locator('tbody tr').filter({ hasText: `#${loteId}` })
    await expect(subRow).toHaveCount(1)
    const subCellText = await subRow.locator('td').first().textContent()
    const subloteId = subCellText.match(/#(\d+)/)[1]

    await page.getByRole('button', { name: 'Redes', exact: true }).click()
    await page.getByLabel('Sub-lote verde disponible *').selectOption({ value: subloteId })
    await page.getByLabel('Producto (red terminada) *').selectOption({ label: 'Platano verde en red' })
    await page.getByLabel('Fecha vencimiento *').fill('2027-06-01')

    await page.getByLabel('Cantidad de cajas').fill('1')
    await page.getByLabel('Redes por caja').fill('5')
    await page.getByLabel('Peso por caja (kg)').fill('10')
    await page.getByRole('button', { name: 'Generar cajas' }).click()

    await page.getByRole('button', { name: /Registrar 1 caja/ }).click()
    await expect(successMessage(page, '1 caja registrada (5 redes en total)')).toBeVisible()

    await page.getByRole('tab', { name: 'Consultar' }).click()
    await page.getByPlaceholder('#red, #sublote o producto').fill(subloteId)

    const netsRow = page.locator('table.providers-table tbody tr').filter({ hasText: 'Platano verde en red' })
    await expect(netsRow).toHaveCount(1)
    await expect(netsRow).toContainText('5')
  })
})
