import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'
import { createMateriaPrimaEntry, acceptPendingLot, findSublotIdInTab, goToModule, successMessage } from './helpers.js'

// Verifica el plan de proceso obligatorio por producto: un Producto Terminado no se puede
// crear sin definir su plan de etapas, y una vez definido, el proceso solo admite registrar
// las etapas de ese plan (no otras del catalogo) hasta completarlas todas para finalizar.
test.describe('Modulo Produccion - plan de etapas por producto', () => {
  test.use({ storageState: authFile('Administrador') })

  test('exige un plan al crear el producto y bloquea finalizar hasta completarlo', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())

    const productName = `E2E Producto Receta ${Date.now().toString(36)}`

    await page.goto('/')

    // --- Producto terminado nuevo, con su plan de proceso definido en el mismo formulario ---
    await goToModule(page, 'Productos')
    await page.getByRole('button', { name: '+ Agregar producto' }).click()
    await page.getByLabel('Nombre *').fill(productName)
    await page.getByLabel('Tipo producto *').selectOption('Producto Terminado')

    // Sin etapas en el plan, no deja crear el producto.
    await page.getByRole('button', { name: 'Crear producto' }).click()
    await expect(page.getByText(/al menos una etapa/)).toBeVisible()

    for (const etapa of ['Pelado', 'Corte']) {
      await page.getByLabel('Etapa a agregar al plan').selectOption({ label: etapa })
      await page.getByRole('button', { name: '+ Agregar al plan' }).click()
    }

    const planTable = page.locator('table.providers-table')
    await expect(planTable.locator('tbody tr').filter({ hasText: 'Pelado' })).toHaveCount(1)
    await expect(planTable.locator('tbody tr').filter({ hasText: 'Corte' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Crear producto' }).click()
    await expect(successMessage(page, 'Producto creado correctamente')).toBeVisible()

    // --- Materia prima -> Maduro -> sub-lote listo para produccion ---
    const docRef = `E2E-RECETA-${Date.now().toString(36)}`
    const entryId = await createMateriaPrimaEntry(page, docRef)
    const loteId = await acceptPendingLot(page, entryId, 'Maduro')
    const subloteId = await findSublotIdInTab(page, loteId, /Listos para produccion/)

    // --- Iniciar proceso para el producto con receta ---
    await goToModule(page, 'Produccion')
    await page.getByRole('button', { name: '+ Iniciar proceso' }).click()
    await page.getByLabel('Sub-lote listo para produccion *').selectOption({ value: subloteId })
    await page.getByLabel('Producto resultado *').selectOption({ label: productName })
    await page.getByRole('button', { name: 'Iniciar proceso' }).click()
    await expect(successMessage(page, 'Proceso de produccion iniciado correctamente')).toBeVisible()

    const processRow = page.locator('table.providers-table tbody tr').filter({ hasText: `#${subloteId}` })
    await processRow.getByRole('button', { name: 'Gestionar' }).click()

    // Verificar el checklist de etapas requeridas, ambas pendientes al inicio
    await expect(page.getByText('Etapas requeridas para este producto')).toBeVisible()
    await expect(page.getByText('○ Pelado')).toBeVisible()
    await expect(page.getByText('○ Corte')).toBeVisible()

    // --- El selector de etapa solo ofrece las etapas del plan, no el resto del catalogo ---
    await page.getByRole('button', { name: 'Agregar etapa' }).click()
    const stageModal = page.locator('.modal-backdrop').last()
    const stageTypeSelect = stageModal.getByLabel('Etapa *')
    await expect(stageTypeSelect.getByRole('option', { name: 'Pelado' })).toHaveCount(1)
    await expect(stageTypeSelect.getByRole('option', { name: 'Corte' })).toHaveCount(1)
    await expect(stageTypeSelect.getByRole('option', { name: 'Fritura' })).toHaveCount(0)
    await expect(stageTypeSelect.getByRole('option', { name: 'Embalaje' })).toHaveCount(0)

    // --- Solo se registra Pelado, falta Corte ---
    await stageModal.getByLabel('Etapa *').selectOption({ label: 'Pelado' })
    await stageModal.getByLabel('Cantidad de personas *').fill('2')
    await stageModal.getByRole('button', { name: 'Iniciar etapa' }).click()
    await expect(successMessage(page, 'Etapa iniciada correctamente')).toBeVisible()
    await expect(page.getByText('✓ Pelado')).toBeVisible()
    await expect(page.getByText('○ Corte')).toBeVisible()

    // --- Intentar finalizar: debe bloquear por falta de la etapa Corte ---
    await page.getByRole('button', { name: 'Finalizar proceso' }).click()
    const finalizeModal = page.locator('.modal-backdrop').last()
    await finalizeModal.getByLabel('Cantidad producida (kg) *').fill('20')
    await finalizeModal.getByLabel('Fecha fin *').fill('2026-09-05T16:00')
    await finalizeModal.getByLabel('Fecha vencimiento *').fill('2027-01-01')
    await finalizeModal.getByRole('button', { name: 'Finalizar proceso' }).click()
    await expect(finalizeModal.getByText(/Faltan etapas requeridas.*Corte/)).toBeVisible()
    await finalizeModal.getByRole('button', { name: 'Cerrar' }).click()

    // --- Completar la etapa faltante ---
    await page.getByRole('button', { name: 'Agregar etapa' }).click()
    const secondStageModal = page.locator('.modal-backdrop').last()
    await secondStageModal.getByLabel('Etapa *').selectOption({ label: 'Corte' })
    await secondStageModal.getByLabel('Cantidad de personas *').fill('2')
    await secondStageModal.getByRole('button', { name: 'Iniciar etapa' }).click()
    await expect(successMessage(page, 'Etapa iniciada correctamente')).toBeVisible()
    await expect(page.getByText('✓ Corte')).toBeVisible()

    // --- Ahora si debe poder finalizar ---
    await page.getByRole('button', { name: 'Finalizar proceso' }).click()
    const finalFinalizeModal = page.locator('.modal-backdrop').last()
    await finalFinalizeModal.getByLabel('Cantidad producida (kg) *').fill('20')
    await finalFinalizeModal.getByLabel('Fecha fin *').fill('2026-09-05T17:00')
    await finalFinalizeModal.getByLabel('Fecha vencimiento *').fill('2027-01-01')
    await finalFinalizeModal.getByRole('button', { name: 'Finalizar proceso' }).click()
    await expect(successMessage(page, 'finalizado correctamente')).toBeVisible()
  })
})
