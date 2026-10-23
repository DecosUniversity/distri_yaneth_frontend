// Captura evidencias de los defectos en la UI QA.
// Uso: node shots.cjs <FRONTEND_NODE_MODULES> <BASE_URL> <OUT_DIR> <IDS_JSON>   (STEP=cli|rec|pro1|pro2|rep1|rep2 opcional)
const path = require('path');
const fs = require('fs');
const [NM, BASE, OUT, IDS] = process.argv.slice(2);
const { chromium } = require(path.join(NM, 'playwright'));
const ids = JSON.parse(fs.readFileSync(IDS, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

async function goToModule(page, label) {
  const btn = page.getByRole('button', { name: label, exact: true });
  if (!(await btn.isVisible().catch(() => false))) {
    const groups = page.locator('nav button[aria-expanded="false"]');
    const n = await groups.count();
    for (let i = 0; i < n; i += 1) {
      await groups.nth(0).click().catch(() => {});
      if (await btn.isVisible().catch(() => false)) break;
    }
  }
  await btn.click();
}

// Recuadro rojo + etiqueta sobre la zona del error
async function annotateBox(page, box, text) {
  await page.evaluate(({ box, text }) => {
    const sx = window.scrollX; const sy = window.scrollY;
    const r = document.createElement('div');
    r.className = 'qa-annot';
    Object.assign(r.style, { position: 'absolute', left: `${box.x + sx - 6}px`, top: `${box.y + sy - 6}px`, width: `${box.width + 12}px`, height: `${box.height + 12}px`, border: '3px solid #e11d48', borderRadius: '6px', zIndex: 2147483646, pointerEvents: 'none', boxShadow: '0 0 0 3px rgba(225,29,72,.25)' });
    const t = document.createElement('div');
    t.className = 'qa-annot';
    t.textContent = text;
    Object.assign(t.style, { position: 'absolute', left: `${Math.max(4, box.x + sx - 6)}px`, top: `${Math.max(0, box.y + sy - 42)}px`, maxWidth: '760px', whiteSpace: 'nowrap', background: '#e11d48', color: '#fff', font: '600 13px/1.35 Arial, sans-serif', padding: '6px 10px', borderRadius: '6px', zIndex: 2147483647, pointerEvents: 'none' });
    document.body.appendChild(r); document.body.appendChild(t);
    // elemento pegado al borde derecho: la etiqueta se alinea a la derecha y va debajo del recuadro
    const vw = document.documentElement.clientWidth;
    if (box.x + t.offsetWidth > vw - 8) {
      t.style.left = `${Math.max(4, box.x + sx + box.width + 6 - t.offsetWidth)}px`;
      t.style.top = `${box.y + sy + box.height + 12}px`;
    }
  }, { box, text });
}
async function annotate(page, locator, text) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const box = await locator.boundingBox();
  if (!box) throw new Error('sin boundingBox para anotar: ' + text);
  await annotateBox(page, box, text);
}
async function annotateUnion(page, loc, text) {
  const n = await loc.count();
  const boxes = [];
  for (let i = 0; i < n; i += 1) { const b = await loc.nth(i).boundingBox(); if (b) boxes.push(b); }
  if (!boxes.length) throw new Error('sin cajas para anotar: ' + text);
  const x = Math.min(...boxes.map((b) => b.x)); const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width)); const btm = Math.max(...boxes.map((b) => b.y + b.height));
  await annotateBox(page, { x, y, width: r - x, height: btm - y }, text);
}
async function banner(page, text) {
  await page.evaluate((text) => {
    const b = document.createElement('div');
    b.className = 'qa-annot';
    b.textContent = text;
    Object.assign(b.style, { position: 'fixed', right: '200px', top: '40px', background: 'rgba(17,24,39,.92)', color: '#fff', font: '12px/1.4 Consolas, monospace', padding: '8px 12px', borderRadius: '6px', zIndex: 2147483647, whiteSpace: 'pre' });
    document.body.appendChild(b);
  }, text);
}
const clearAnnot = (page) => page.evaluate(() => document.querySelectorAll('.qa-annot').forEach((n) => n.remove()));
const stamp = () => new Date().toLocaleString('es-GT');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());

  await page.goto(BASE + '/login');
  await page.getByLabel('Usuario').fill('dennis');
  await page.getByLabel('Contrasena').fill('123456');
  await page.getByRole('button', { name: /Entrar al sistema/ }).click();
  await page.getByRole('button', { name: 'Cerrar sesion' }).waitFor();

  const step = process.env.STEP || 'all';
  const want = (s) => step === 'all' || step === s;
  const shot = async (name, fullPage = false) => { await page.screenshot({ path: path.join(OUT, name), fullPage }); await clearAnnot(page); };
  const home = async (mod) => { await page.goto(BASE + '/'); await goToModule(page, mod); await page.waitForTimeout(700); };
  const meta = (bug, tc, extra = '') => banner(page, `${bug} · ${tc}\nQA local · BD proyecto_graduacion_qa · ${stamp()}${extra ? '\n' + extra : ''}`);

  if (want('cli')) {
    await home('Clientes');
    await page.getByRole('button', { name: '+ Agregar cliente' }).click();
    await page.getByLabel('Nombre comercial *').fill('Cliente QA Duplicado (UI)');
    await page.getByLabel('Departamento').selectOption('Guatemala');
    await page.getByLabel('Municipio').fill('Guatemala');
    await page.getByLabel('Zona').fill('10');
    await page.getByPlaceholder('NIT facturacion').fill(ids.cli.nit);
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    const ok = page.locator('p.feedback.success', { hasText: 'Cliente creado correctamente' });
    await ok.waitFor();
    await page.waitForTimeout(3000); // deja que desaparezca el toast flotante
    const list = page.getByRole('region', { name: 'Listado de clientes' });
    await list.getByRole('button', { name: /Mostrar|Ocultar/ }).click();
    const rows = list.getByRole('row').filter({ hasText: ids.cli.nit });
    await rows.first().waitFor();
    const n = await rows.count();
    await annotate(page, ok, 'Mensaje de éxito: el sistema aceptó el NIT repetido');
    await rows.first().scrollIntoViewIfNeeded();
    await annotateUnion(page, rows, `BUG-CLI-01: ${n} clientes activos con el mismo NIT ${ids.cli.nit}`);
    await meta('BUG-CLI-01', 'TC-REQ001-005');
    await shot('Evidencia_BUG-CLI-01.png', true);
  }

  if (want('rec')) {
    await home('Entradas');
    await page.getByRole('tab', { name: 'Consultar', exact: true }).click();
    await page.waitForTimeout(700);
    const row = page.locator('table.providers-table').first().getByRole('row').filter({ hasText: ids.rec.codigo_lote });
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    const modal = page.locator('.modal-backdrop').last();
    await modal.waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, '_dbg_rec.png') });
    const neg = modal.getByText(/-5(\.0+)?\b/).first();
    await annotate(page, neg, 'BUG-REC-01: unidad registrada con peso negativo (−5) vía POST /units → HTTP 201');
    await meta('BUG-REC-01', 'TC-REQ002-002', `Entrada ${ids.rec.codigo_lote} (#${ids.rec.id_entrada})`);
    await shot('Evidencia_BUG-REC-01.png');
  }

  if (want('pro1')) {
    await home('Produccion');
    const row = page.getByRole('row').filter({ hasText: ids.pro1.codigo }).first();
    await row.waitFor();
    await annotate(page, row, 'BUG-PRO-01: Ingresado 50.00 kg pero Merma total 60.00 kg — la merma supera la entrada');
    await meta('BUG-PRO-01', 'TC-REQ003-002', `Proceso ${ids.pro1.codigo}`);
    await shot('Evidencia_BUG-PRO-01_listado.png');
    await row.getByRole('button', { name: 'Gestionar' }).click();
    const detail = page.locator('.inline-detail-view');
    await detail.waitFor();
    await page.waitForTimeout(1200);
    const corte = detail.getByRole('row').filter({ hasText: 'Corte' }).first();
    await corte.waitFor();
    await annotate(page, corte, 'BUG-PRO-01: etapa Corte con entrada 50 kg y merma 60 kg; la salida se fuerza a 0 kg');
    await meta('BUG-PRO-01', 'TC-REQ003-002', `Proceso ${ids.pro1.codigo}`);
    await shot('Evidencia_BUG-PRO-01.png');
  }

  if (want('pro2')) {
    await home('Trazabilidad');
    await page.getByPlaceholder(/Codigo de lote/).fill(ids.pro2.codigo);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    const diff = page.getByText(/Diferencia de balance de masa/).first();
    await diff.waitFor();
    await annotate(page, diff, 'BUG-PRO-02: proceso Finalizado con diferencia de 5 kg y justificación en blanco ("   ")');
    await meta('BUG-PRO-02', 'TC-REQ003-008', `Proceso ${ids.pro2.codigo} · cierre vía POST /finalizar (HTTP 200)`);
    await shot('Evidencia_BUG-PRO-02.png');
  }

  if (want('rep1')) {
    await home('Pedidos');
    await page.getByRole('tab', { name: 'Reportes', exact: true }).click();
    await page.waitForTimeout(700);
    const pdf = page.getByRole('button', { name: /Descargar PDF/ }).first();
    await pdf.waitFor();
    await annotate(page, pdf, 'BUG-REP-01: única opción de exportación es PDF; no existe exportar a Excel');
    await meta('BUG-REP-01', 'TC-REQ005-003');
    await shot('Evidencia_BUG-REP-01.png');
  }

  if (want('rep2')) {
    await home('Trazabilidad');
    await page.getByRole('button', { name: 'Busqueda avanzada por fechas' }).click();
    const dates = page.locator('input[type="date"]');
    await dates.nth(1).waitFor();
    await dates.nth(0).fill('2026-10-15');
    await dates.nth(1).fill('2026-10-10');
    await page.getByRole('button', { name: /Buscar/ }).last().click();
    await page.waitForTimeout(1500);
    await annotateUnion(page, dates, 'BUG-REP-02: Desde 15/10/2026 > Hasta 10/10/2026 — la búsqueda se ejecuta sin advertencia');
    await meta('BUG-REP-02', 'TC-REQ005-004', 'API: GET /api/pedidos/reportes/compras-por-cliente → HTTP 200 []');
    await shot('Evidencia_BUG-REP-02.png');
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
