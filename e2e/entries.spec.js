import { test, expect } from '@playwright/test'
import { authFile } from './test-users.js'

const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

test.describe('Modulo Entradas - CRUD', () => {
  test.use({ storageState: authFile('Administrador') })

  test('registra y elimina una entrada de mercancia (producto tipo Insumo)', async ({ page }) => {
    // Se usa un producto tipo Insumo (no Materia Prima) para no depender del flujo de
    // Maduracion: una entrada de Materia Prima genera un lote de maduracion asociado y solo
    // aparece en la pestana "Gestion" mientras ese lote siga pendiente.
    const docRef = `E2E-DOC-${Date.now().toString(36)}`

    await page.goto('/')
    await page.getByRole('button', { name: 'Entradas', exact: true }).click()
    await page.getByRole('button', { name: 'Agregar' }).click()

    await page.getByLabel('Proveedor *').selectOption({ index: 1 })
    await page.getByLabel('Producto *').selectOption({ label: 'Bolsa Plastica 3 LBS' })
    await page.getByLabel('Fecha vencimiento *').fill('2027-01-01')
    await page.getByLabel('Costo unitario').fill('2.50')
    await page.getByLabel('Documento de referencia').fill(docRef)

    // Anadir una unidad pesada (obligatorio para poder registrar la entrada)
    await page.getByRole('button', { name: 'Añadir unidad' }).click()
    const addUnitModal = page.locator('.modal-backdrop').last()
    await addUnitModal.getByLabel('Peso (kg)').fill('10')
    await addUnitModal.getByLabel('Fecha pesaje').fill('2026-09-01T08:00')
    await addUnitModal.getByRole('button', { name: 'Añadir unidad' }).click()

    await page.getByRole('button', { name: 'Registrar entrada' }).click()
    await expect(successMessage(page, 'Entrada de mercancia registrada correctamente')).toBeVisible()

    // Un insumo no aparece en "Gestion" (esa pestana solo muestra materia prima pendiente de
    // aceptar en maduracion), asi que se busca en "Consultar" por el documento de referencia.
    await page.getByRole('tab', { name: 'Consultar' }).click()
    await page.getByPlaceholder('Proveedor, producto, documento o receptor').fill(docRef)

    // La tabla de "Existencias Totales" mas abajo comparte la misma clase; se toma la primera
    // tabla de la pagina, que es la de entradas.
    const entriesTable = page.locator('table.providers-table').first()
    const row = entriesTable.locator('tbody tr').filter({ hasText: 'Bolsa Plastica 3 LBS' })
    await expect(row).toHaveCount(1)

    // Eliminar (usa un modal de confirmacion propio, no window.confirm)
    await row.getByRole('button', { name: 'Eliminar' }).click()
    await page.getByRole('button', { name: 'Si, eliminar' }).click()
    await expect(successMessage(page, 'Entrada eliminada correctamente')).toBeVisible()

    await page.getByPlaceholder('Proveedor, producto, documento o receptor').fill(docRef)
    await expect(entriesTable.locator('tbody tr').filter({ hasText: 'Bolsa Plastica 3 LBS' })).toHaveCount(0)
  })
})
