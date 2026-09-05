import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Tipos de Servicio - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea, edita y elimina un tipo de servicio', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const name = `E2E Servicio ${Date.now()}`
    const editedName = `${name} editado`

    await page.goto('/')
    await page.getByRole('button', { name: 'Tipos Servicio', exact: true }).click()

    // Crear
    await page.getByLabel('Nombre del servicio *').fill(name)
    await page.getByLabel('Frecuencia (km)').fill('5000')
    await page.getByRole('button', { name: 'Crear tipo' }).click()
    await expect(successMessage(page, 'Tipo de servicio creado correctamente')).toBeVisible()

    // Expandir el listado (viene colapsado por defecto)
    const listSection = page.getByRole('region', { name: 'Listado de tipos de servicio' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible()

    // Editar
    await row.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Nombre del servicio *').fill(editedName)
    await page.getByRole('button', { name: 'Actualizar tipo' }).click()
    await expect(successMessage(page, 'Tipo de servicio actualizado correctamente')).toBeVisible()

    const editedRow = listSection.getByRole('row', { name: new RegExp(editedName) })
    await expect(editedRow).toBeVisible()

    // Eliminar
    await editedRow.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Tipo de servicio eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(editedName) })).toHaveCount(0)
  })
})
