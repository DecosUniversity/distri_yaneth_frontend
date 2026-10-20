import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { goToModule } from './helpers.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Servicios de Vehiculo - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('crea un servicio de vehiculo y no permite editarlo ni eliminarlo', async ({ page }) => {
    const notas = `E2E nota ${Date.now().toString(36)}`

    await page.goto('/')
    await goToModule(page, 'Servicios Vehiculo')

    // Crear (se apoya en que ya existe al menos un vehiculo y un tipo de servicio reales)
    await page.getByRole('button', { name: '+ Agregar servicio' }).click()
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

    // Un servicio registrado no se puede editar ni eliminar (acciones ocultas)
    await expect(row.getByRole('button', { name: 'Editar' })).toHaveCount(0)
    await expect(row.getByRole('button', { name: 'Eliminar' })).toHaveCount(0)
  })
})
