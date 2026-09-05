import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { ROLE_MODULE_PERMISSIONS, MODULE_DEFINITIONS } from '../src/config/rolePermissions.js'

// Smoke test de navegacion: para cada rol, verifica que el menu lateral muestre exactamente
// los modulos permitidos (ni mas ni menos) y que cada uno cargue sin errores de JS al hacer clic.
for (const [role, moduleKeys] of Object.entries(ROLE_MODULE_PERMISSIONS)) {
  test.describe(`Navegacion - rol ${role}`, () => {
    test.use({ storageState: authFile(role) })

    test(`el menu lateral muestra exactamente los modulos permitidos para ${role}`, async ({ page }) => {
      await page.goto('/')

      const nav = page.getByRole('navigation', { name: 'Secciones del dashboard' })
      const expectedLabels = moduleKeys.map((key) => MODULE_DEFINITIONS[key].label)

      await expect(nav.getByRole('button')).toHaveText(expectedLabels)
    })

    test(`cada modulo permitido para ${role} carga sin errores`, async ({ page }) => {
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error))

      await page.goto('/')

      for (const key of moduleKeys) {
        const label = MODULE_DEFINITIONS[key].label

        await page.getByRole('button', { name: label, exact: true }).click()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
        await expect(page.locator('.dashboard-content')).toBeVisible()
      }

      expect(pageErrors).toEqual([])
    })
  })
}
