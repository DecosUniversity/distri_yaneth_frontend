import { test as setup, expect } from '@playwright/test'
import { E2E_USERS, authFile } from './test-users.js'

for (const [role, credentials] of Object.entries(E2E_USERS)) {
  setup(`login como ${role}`, async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Usuario').fill(credentials.username)
    await page.getByLabel('Contrasena').fill(credentials.password)
    await page.getByRole('button', { name: /Entrar al sistema/ }).click()

    await expect(page.getByRole('button', { name: 'Cerrar sesion' })).toBeVisible()

    await page.context().storageState({ path: authFile(role) })
  })
}
