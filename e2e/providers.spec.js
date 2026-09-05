import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Proveedores - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea, edita y elimina un proveedor', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const providerName = `E2E Proveedor ${Date.now()}`
    const editedName = `${providerName} editado`

    await page.goto('/')
    await page.getByRole('button', { name: 'Proveedores', exact: true }).click()

    // Crear
    await page.getByLabel('Empresa *').fill(providerName)
    await page.getByLabel('Contacto').fill('Contacto de prueba')
    await page.getByRole('button', { name: 'Crear proveedor' }).click()
    await expect(successMessage(page, 'Proveedor creado correctamente')).toBeVisible()

    // Expandir el listado (viene colapsado por defecto)
    const listSection = page.getByRole('region', { name: 'Listado de proveedores' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(providerName) })
    await expect(row).toBeVisible()

    // Editar
    await row.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Empresa *').fill(editedName)
    await page.getByRole('button', { name: 'Actualizar proveedor' }).click()
    await expect(successMessage(page, 'Proveedor actualizado correctamente')).toBeVisible()

    const editedRow = listSection.getByRole('row', { name: new RegExp(editedName) })
    await expect(editedRow).toBeVisible()

    // Eliminar
    await editedRow.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Proveedor eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(editedName) })).toHaveCount(0)
  })
})
