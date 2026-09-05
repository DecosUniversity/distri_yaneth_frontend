import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { successMessage } from './helpers.js'

test.describe('Modulo Usuarios - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea un usuario, restablece su password y lo elimina', async ({ page }) => {
    // Contraseña usa window.prompt, Eliminar usa window.confirm: se responden distinto segun el tipo.
    page.on('dialog', (dialog) => {
      if (dialog.type() === 'prompt') {
        dialog.accept('NuevaClave123')
      } else {
        dialog.accept()
      }
    })

    const username = `e2e.temp.${Date.now().toString(36)}`

    await page.goto('/')
    await page.getByRole('button', { name: 'Usuarios', exact: true }).click()

    await page.getByLabel('Nombre completo *').fill('E2E Usuario Temporal')
    await page.getByLabel('Username *').fill(username)
    await page.getByLabel('Password inicial *').fill('ClaveInicial123')
    await page.getByLabel('Rol *').selectOption('Piloto')
    await page.getByRole('button', { name: 'Crear usuario' }).click()
    await expect(successMessage(page, 'Usuario creado correctamente')).toBeVisible()

    const listSection = page.getByRole('region', { name: 'Listado de usuarios' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(username) })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Piloto')

    await row.getByRole('button', { name: 'Contraseña' }).click()
    await expect(successMessage(page, `Password restablecida para ${username}`)).toBeVisible()

    await row.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Usuario eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(username) })).toHaveCount(0)
  })
})
