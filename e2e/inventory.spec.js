import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

// El modulo de Inventario es solo lectura (consulta y filtros sobre las existencias reales),
// no tiene crear/editar/eliminar, asi que la prueba cubre el listado y el filtrado por texto.
test.describe('Modulo Inventario - listado y filtros', () => {
  test.use({ storageState: authFile('Administrador') })

  test('lista el inventario y filtra por texto de busqueda', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Inventario', exact: true }).click()

    const listSection = page.getByRole('region', { name: 'Listado de inventario' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const rows = listSection.locator('table.providers-table tbody tr')
    await expect(rows.first()).toBeVisible()
    const initialCount = await rows.count()
    expect(initialCount).toBeGreaterThan(0)

    // "Bolsa Plastica 3 LBS" es una existencia real sembrada en la base de datos de demo
    await page.getByLabel('Buscar').fill('Bolsa Plastica')

    const filteredCount = await rows.count()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(initialCount)
    await expect(listSection.locator('table.providers-table')).toContainText('Bolsa Plastica 3 LBS')
    await expect(listSection.locator('table.providers-table')).not.toContainText('Platano Verde')

    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(rows).toHaveCount(initialCount)
  })
})
