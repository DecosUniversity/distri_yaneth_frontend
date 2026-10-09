import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { createMateriaPrimaEntry, acceptPendingLot, findSublotIdInTab, goToModule, successMessage } from './helpers.js'

// El empaque de redes se estandarizo dentro de Produccion ("+ Empacar red"): un sub-lote Verde
// inicia un proceso de produccion como cualquier otro (mismo mecanismo, con su etapa y su
// desglose de cajas), en vez del formulario aparte que existia antes en el modulo Redes.
test.describe('Modulo Produccion - empacar red', () => {
  test.use({ storageState: authFile('Administrador') })

  test('empaca un sub-lote verde disponible como un proceso de produccion mas, con cajas', async ({ page }) => {
    const docRef = `E2E-RED-${Date.now().toString(36)}`

    await page.goto('/')
    const entryId = await createMateriaPrimaEntry(page, docRef)
    // "Verde" deja el sub-lote Activo, el unico estado (junto a Listo para produccion) que
    // productionProcesses.create acepta para iniciar un proceso.
    const loteId = await acceptPendingLot(page, entryId, 'Verde')
    const subloteId = await findSublotIdInTab(page, loteId, /Activos/)

    await goToModule(page, 'Produccion')
    await page.getByRole('button', { name: '+ Empacar red' }).click()
    await page.getByLabel('Sub-lote verde disponible *').selectOption({ value: subloteId })
    await page.getByLabel('Producto resultado (red terminada) *').selectOption({ label: 'Platano verde en red' })
    await page.getByLabel('Etapa *').selectOption({ label: 'Pelado' })
    await page.getByLabel('Cantidad de personas *').fill('2')

    await page.getByLabel('Cantidad de cajas').fill('1')
    await page.getByLabel('Redes por caja').fill('5')
    await page.getByLabel('Peso por caja (kg)').fill('10')
    await page.getByRole('button', { name: 'Generar cajas' }).click()

    await page.getByRole('button', { name: /Empacar 1 caja/ }).click()
    await expect(successMessage(page, 'Red empacada: 1 caja (5 redes, 10.00 kg)')).toBeVisible()

    // El proceso resultante se gestiona igual que cualquier otro: se ve la etapa con su
    // desglose de cajas dentro del detalle.
    const processRow = page.locator('table.providers-table tbody tr').filter({ hasText: `#${subloteId}` })
    await processRow.getByRole('button', { name: 'Gestionar' }).click()
    await expect(page.getByText('1 caja · 5 redes')).toBeVisible()
  })
})
