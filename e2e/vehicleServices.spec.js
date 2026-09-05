import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Servicios de Vehiculo - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea, edita y elimina un servicio de vehiculo', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const notas = `E2E nota ${Date.now().toString(36)}`
    const editedNotas = `${notas} editado`

    await page.goto('/')
    await page.getByRole('button', { name: 'Servicios Vehiculo', exact: true }).click()

    // Crear (se apoya en que ya existe al menos un vehiculo y un tipo de servicio reales)
    await page.getByLabel('Vehiculo *').selectOption({ index: 1 })
    await page.getByLabel('Tipo de servicio *').selectOption({ index: 1 })
    await page.getByLabel('Fecha de servicio *').fill('2026-08-01')
    await page.getByLabel('Costo del servicio').fill('150.50')
    await page.getByLabel('Proximo servicio km').fill('5000')
    await page.getByLabel('Notas').fill(notas)
    await page.getByRole('button', { name: 'Crear servicio' }).click()
    await expect(successMessage(page, 'Servicio de vehiculo creado correctamente')).toBeVisible()

    // Expandir el listado (viene colapsado por defecto)
    const listSection = page.getByRole('region', { name: 'Listado de servicios' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(notas) })
    await expect(row).toBeVisible()
    await expect(row).toContainText('150.50')

    // Editar
    await row.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Costo del servicio').fill('200')
    await page.getByLabel('Notas').fill(editedNotas)
    await page.getByRole('button', { name: 'Actualizar servicio' }).click()
    await expect(successMessage(page, 'Servicio de vehiculo actualizado correctamente')).toBeVisible()

    const editedRow = listSection.getByRole('row', { name: new RegExp(editedNotas) })
    await expect(editedRow).toBeVisible()
    await expect(editedRow).toContainText('200.00')

    // Eliminar
    await editedRow.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Servicio de vehiculo eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(editedNotas) })).toHaveCount(0)
  })
})
