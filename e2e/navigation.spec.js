import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { ROLE_MODULE_PERMISSIONS, getNavigationTree } from '../src/config/rolePermissions.js'

// Smoke test de navegacion: para cada rol, verifica que el menu lateral (agrupado en modulos
// generales) muestre exactamente los modulos y grupos permitidos, y que cada modulo cargue sin
// errores de JS al hacer clic (expandiendo su grupo primero cuando aplica).
for (const role of Object.keys(ROLE_MODULE_PERMISSIONS)) {
  test.describe(`Navegacion - rol ${role}`, () => {
    test.use({ storageState: authFile(role) })

    const navigationTree = getNavigationTree(role)

    test(`el menu lateral muestra exactamente los modulos y grupos permitidos para ${role}`, async ({ page }) => {
      await page.goto('/')

      const nav = page.getByRole('navigation', { name: 'Secciones del dashboard' })

      // Expandir todos los grupos para que sus modulos aparezcan en el DOM.
      for (const entry of navigationTree) {
        if (entry.type === 'group') {
          await nav.getByRole('button', { name: entry.label, exact: true }).click()
        }
      }

      // El boton de grupo incluye la flechita "▾" como texto visible (aunque este aria-hidden,
      // .toHaveText() compara el textContent renderizado, no el nombre accesible).
      const expectedLabels = navigationTree.flatMap((entry) =>
        entry.type === 'standalone' ? [entry.module.label] : [`${entry.label}▾`, ...entry.modules.map((m) => m.label)]
      )

      await expect(nav.getByRole('button')).toHaveText(expectedLabels)
    })

    test(`cada modulo permitido para ${role} carga sin errores`, async ({ page }) => {
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error))

      await page.goto('/')
      const nav = page.getByRole('navigation', { name: 'Secciones del dashboard' })

      for (const entry of navigationTree) {
        if (entry.type === 'group') {
          await nav.getByRole('button', { name: entry.label, exact: true }).click()
        }

        const modules = entry.type === 'standalone' ? [entry.module] : entry.modules

        for (const moduleItem of modules) {
          await page.getByRole('button', { name: moduleItem.label, exact: true }).click()
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(moduleItem.label)
          await expect(page.locator('.dashboard-content')).toBeVisible()
        }
      }

      expect(pageErrors).toEqual([])
    })
  })
}
