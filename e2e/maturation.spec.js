import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { createMateriaPrimaEntry, successMessage } from './helpers.js'

test.describe('Modulo Maduracion - flujo de lotes y sub-lotes', () => {
  test.use({ storageState: authFile('Administrador') })

  test('una entrada pendiente se puede eliminar antes de aceptarla', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
    const docRef = `E2E-MAD-DEL-${Date.now().toString(36)}`

    await page.goto('/')
    const entryId = await createMateriaPrimaEntry(page, docRef)

    await page.getByRole('button', { name: 'Maduracion MP', exact: true }).click()
    const pendingTable = page.locator('table.providers-table').first()
    const pendingRow = pendingTable.locator('tbody tr').filter({ hasText: `#${entryId}` })
    await expect(pendingRow).toHaveCount(1)
    await expect(pendingRow).toContainText('Platano Verde')

    await pendingRow.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Lote eliminado correctamente')).toBeVisible()
    await expect(pendingTable.locator('tbody tr').filter({ hasText: `#${entryId}` })).toHaveCount(0)
  })

  test('aceptar un lote como Maduro crea un sub-lote listo para produccion', async ({ page }) => {
    const docRef = `E2E-MAD-ACC-${Date.now().toString(36)}`

    await page.goto('/')
    const entryId = await createMateriaPrimaEntry(page, docRef)

    await page.getByRole('button', { name: 'Maduracion MP', exact: true }).click()
    const pendingTable = page.locator('table.providers-table').first()
    const pendingRow = pendingTable.locator('tbody tr').filter({ hasText: `#${entryId}` })
    await expect(pendingRow).toHaveCount(1)

    const loteCellText = await pendingRow.locator('td').first().textContent()
    const loteId = loteCellText.trim().replace('#', '')

    await pendingRow.getByRole('button', { name: 'Aceptar' }).click()
    await page.getByLabel('Estado de maduracion *').selectOption('Maduro')
    await page.getByRole('button', { name: 'Aceptar entrada' }).click()
    await expect(successMessage(page, `Lote #${loteId} aceptado`)).toBeVisible()

    // Maduro pasa directo a "Listo para produccion" (sin control de laboratorio)
    await page.getByRole('button', { name: /Listos para produccion/ }).click()
    const sublotsTable = page.locator('table.providers-table').last()
    const sublotRow = sublotsTable.locator('tbody tr').filter({ hasText: `#${loteId}` })
    await expect(sublotRow).toHaveCount(1)
    await expect(sublotRow).toContainText('Platano Verde')
  })
})
