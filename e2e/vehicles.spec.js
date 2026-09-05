import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Vehiculos - CRUD (Administrador)', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea, edita y elimina un vehiculo', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    // base36 conserva toda la entropia de Date.now() en pocos caracteres (placa es varchar(15) UNIQUE)
    const placa = `E2E${Date.now().toString(36)}`.toUpperCase()

    await page.goto('/')
    await page.getByRole('button', { name: 'Vehiculos', exact: true }).click()

    // Crear
    await page.getByLabel('Placa *').fill(placa)
    await page.getByLabel('Modelo').fill('Modelo de prueba')
    await page.getByLabel('Kilometraje actual').fill('1000')
    await page.getByRole('button', { name: 'Crear vehiculo' }).click()
    await expect(successMessage(page, 'Vehiculo creado correctamente')).toBeVisible()

    // Expandir el listado (viene colapsado por defecto)
    const listSection = page.getByRole('region', { name: 'Listado de vehiculos' })
    await listSection.getByRole('button', { name: /Mostrar|Ocultar/ }).click()

    const row = listSection.getByRole('row', { name: new RegExp(placa.toUpperCase()) })
    await expect(row).toBeVisible()

    // Editar
    await row.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Estado').selectOption('Mantenimiento')
    await page.getByRole('button', { name: 'Actualizar vehiculo' }).click()
    await expect(successMessage(page, 'Vehiculo actualizado correctamente')).toBeVisible()
    await expect(row).toContainText('Mantenimiento')

    // Eliminar
    await row.getByRole('button', { name: 'Eliminar' }).click()
    await expect(successMessage(page, 'Vehiculo eliminado correctamente')).toBeVisible()
    await expect(listSection.getByRole('row', { name: new RegExp(placa.toUpperCase()) })).toHaveCount(0)
  })
})

// Nota: el rol Piloto no tiene el modulo Vehiculos en su menu (ROLE_MODULE_PERMISSIONS no lo
// incluye), asi que la logica `isPilot` dentro de VehiclesModule.jsx es codigo muerto/heredado
// que no es alcanzable desde la UI real y no aplica probarla aqui.
