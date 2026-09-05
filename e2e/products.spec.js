import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

// El aviso de exito aparece dos veces (el <p class="feedback success"> inline y el toast de
// SweetAlert2): se apunta al mensaje inline, que es el que persiste en el DOM.
const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Productos - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea, edita y elimina un producto', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const productName = `E2E Producto ${Date.now()}`
    const editedName = `${productName} editado`

    await page.goto('/')
    await page.getByRole('button', { name: 'Productos', exact: true }).click()

    // Crear
    await page.getByLabel('Nombre *').fill(productName)
    await page.getByRole('button', { name: 'Crear producto' }).click()
    await expect(successMessage(page, 'Producto creado correctamente')).toBeVisible()

    // Expandir el listado (viene colapsado por defecto)
    const listSection = page.getByRole('region', { name: 'Listado de productos' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(productName) })
    await expect(row).toBeVisible()

    // Editar
    await row.getByRole('button', { name: 'Editar' }).click()
    const nameInput = page.getByLabel('Nombre *')
    await nameInput.fill(editedName)
    await page.getByRole('button', { name: 'Actualizar producto' }).click()
    await expect(successMessage(page, 'Producto actualizado correctamente')).toBeVisible()

    const editedRow = listSection.getByRole('row', { name: new RegExp(editedName) })
    await expect(editedRow).toBeVisible()

    // Eliminar
    await editedRow.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Producto eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(editedName) })).toHaveCount(0)
  })
})
