import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Clientes - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea, edita y elimina un cliente', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const clientName = `E2E Cliente ${Date.now()}`
    const editedName = `${clientName} editado`

    await page.goto('/')
    await page.getByRole('button', { name: 'Clientes', exact: true }).click()

    // Crear
    await page.getByLabel('Nombre comercial *').fill(clientName)
    await page.getByLabel('Departamento').selectOption('Guatemala')
    await page.getByLabel('Municipio').fill('Mixco')
    await page.getByLabel('Zona').fill('5')
    await page.getByRole('button', { name: 'Crear cliente' }).click()
    await expect(successMessage(page, 'Cliente creado correctamente')).toBeVisible()

    // Expandir el listado (viene colapsado por defecto)
    const listSection = page.getByRole('region', { name: 'Listado de clientes' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(clientName) })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Zona 5, Mixco, Guatemala')

    // Editar
    await row.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Nombre comercial *').fill(editedName)
    await page.getByLabel('Municipio').fill('Villa Nueva')
    await page.getByRole('button', { name: 'Actualizar cliente' }).click()
    await expect(successMessage(page, 'Cliente actualizado correctamente')).toBeVisible()

    const editedRow = listSection.getByRole('row', { name: new RegExp(editedName) })
    await expect(editedRow).toBeVisible()
    await expect(editedRow).toContainText('Villa Nueva')

    // Eliminar
    await editedRow.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Cliente eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(editedName) })).toHaveCount(0)
  })
})
