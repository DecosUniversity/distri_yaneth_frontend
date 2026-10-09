import { expect } from '@playwright/test'
import { MODULE_GROUPS, MODULE_DEFINITIONS } from '../src/config/rolePermissions.js'

const GROUP_LABEL_BY_MODULE_LABEL = new Map()
for (const group of MODULE_GROUPS) {
  for (const moduleKey of group.moduleKeys) {
    GROUP_LABEL_BY_MODULE_LABEL.set(MODULE_DEFINITIONS[moduleKey].label, group.label)
  }
}

// Navega a un modulo del sidebar por su label, expandiendo primero el grupo que lo contiene
// (Produccion, Inventario y Catalogos, Distribucion, Flota, Administracion) si hace falta.
// Dashboard y Trazabilidad quedan sueltos, sin grupo, y se hace clic directo.
export async function goToModule(page, label) {
  const groupLabel = GROUP_LABEL_BY_MODULE_LABEL.get(label)

  if (groupLabel) {
    const groupToggle = page.getByRole('button', { name: groupLabel, exact: true })

    if ((await groupToggle.getAttribute('aria-expanded')) !== 'true') {
      await groupToggle.click()
    }
  }

  await page.getByRole('button', { name: label, exact: true }).click()
}

export const successMessage = (page, text) => page.locator('p.feedback.success', { hasText: text })

// Algunas acciones (p.ej. registrar salida o confirmar entregas en Rutas) solo notifican via
// el toast de SweetAlert2 (notifySuccess), sin dejar un <p class="feedback success"> visible.
// El toast dura 3.2s (ver src/utils/toast.js) asi que hay que revisarlo justo despues del click.
export const toastMessage = (page, text) => page.getByRole('heading', { name: text })

// Registra una entrada de Materia Prima (Platano Verde) y devuelve el id de la entrada,
// leido del modal "Ver detalle" (la tabla de entradas no muestra el id directamente).
export async function createMateriaPrimaEntry(page, docRef) {
  await goToModule(page, 'Entradas')
  await page.getByRole('button', { name: 'Agregar' }).click()

  await page.getByLabel('Proveedor *').selectOption({ index: 1 })
  await page.getByLabel('Producto *').selectOption({ label: 'Platano Verde' })
  await page.getByLabel('Fecha vencimiento *').fill('2027-01-01')
  await page.getByLabel('Documento de referencia').fill(docRef)

  await page.getByRole('button', { name: 'Añadir unidad' }).click()
  const addUnitModal = page.locator('.modal-backdrop').last()
  await addUnitModal.getByLabel('Peso (kg)').fill('20')
  await addUnitModal.getByLabel('Fecha pesaje').fill('2026-09-01T08:00')
  await addUnitModal.getByRole('button', { name: 'Añadir unidad' }).click()

  await page.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(successMessage(page, 'Entrada de mercancia registrada correctamente')).toBeVisible()

  await page.getByRole('tab', { name: 'Consultar' }).click()
  await page.getByPlaceholder('Proveedor, producto, documento o receptor').fill(docRef)
  const entriesTable = page.locator('table.providers-table').first()
  const row = entriesTable.locator('tbody tr').filter({ hasText: 'Platano Verde' })
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: 'Ver detalle' }).click()

  const heading = page.locator('.modal-card h4', { hasText: 'Detalle de entrada #' })
  const headingText = await heading.textContent()
  const entryId = headingText.match(/#(\d+)/)[1]
  await page.locator('.modal-card').getByRole('button', { name: 'Cerrar' }).click()

  return entryId
}

// Acepta el lote pendiente creado por createMateriaPrimaEntry con el estado de maduracion
// indicado (por defecto "Verde", que deja el sub-lote Activo). Devuelve el id_lote_mp.
export async function acceptPendingLot(page, entryId, estadoMaduracion = 'Verde') {
  await goToModule(page, 'Maduracion MP')
  const pendingTable = page.locator('table.providers-table').first()
  const pendingRow = pendingTable.locator('tbody tr').filter({ hasText: `#${entryId}` })
  await expect(pendingRow).toHaveCount(1)

  const loteCellText = await pendingRow.locator('td').first().textContent()
  const loteId = loteCellText.trim().replace('#', '')

  await pendingRow.getByRole('button', { name: 'Aceptar' }).click()
  await page.getByLabel('Estado de maduracion *').selectOption(estadoMaduracion)
  await page.getByRole('button', { name: 'Aceptar entrada' }).click()
  await expect(successMessage(page, `Lote #${loteId} aceptado`)).toBeVisible()

  return loteId
}

// Dado un id_lote_mp, entra a la pestana de sub-lotes indicada (Activos / Listos para
// produccion / etc, en la pantalla de Maduracion) y devuelve el id_sublote de la fila
// correspondiente a ese lote.
export async function findSublotIdInTab(page, loteId, tabNameRegex) {
  await page.getByRole('button', { name: tabNameRegex }).click()
  const table = page.locator('table.providers-table').last()
  const row = table.locator('tbody tr').filter({ hasText: `#${loteId}` })
  await expect(row).toHaveCount(1)
  const cellText = await row.locator('td').first().textContent()
  return cellText.match(/#(\d+)/)[1]
}
