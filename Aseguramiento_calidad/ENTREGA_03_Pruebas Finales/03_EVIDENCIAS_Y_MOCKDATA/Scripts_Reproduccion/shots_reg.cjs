// Capturas de REGRESION (despues de corregir): mismos flujos que shots.cjs, ahora el sistema rechaza.
// Uso: node shots_reg.cjs <FRONTEND_NODE_MODULES> <BASE_URL> <OUT_DIR> <IDS_JSON>   (STEP=cli|pro1|rep1|rep2 opcional)
const path = require('path');
const fs = require('fs');
const [NM, BASE, OUT, IDS] = process.argv.slice(2);
const { chromium } = require(path.join(NM, 'playwright'));
const ids = JSON.parse(fs.readFileSync(IDS, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const OK = '#16a34a';

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

async function annotateBox(page, box, text, color = OK) {
  await page.evaluate(({ box, text, color }) => {
    const sx = window.scrollX; const sy = window.scrollY;
    const r = document.createElement('div');
    r.className = 'qa-annot';
    Object.assign(r.style, { position: 'absolute', left: `${box.x + sx - 6}px`, top: `${box.y + sy - 6}px`, width: `${box.width + 12}px`, height: `${box.height + 12}px`, border: `3px solid ${color}`, borderRadius: '6px', zIndex: 2147483646, pointerEvents: 'none' });
    const t = document.createElement('div');
    t.className = 'qa-annot';
    t.textContent = text;
    Object.assign(t.style, { position: 'absolute', left: `${Math.max(4, box.x + sx - 6)}px`, top: `${Math.max(0, box.y + sy - 42)}px`, maxWidth: '760px', whiteSpace: 'nowrap', background: color, color: '#fff', font: '600 13px/1.35 Arial, sans-serif', padding: '6px 10px', borderRadius: '6px', zIndex: 2147483647, pointerEvents: 'none' });
    document.body.appendChild(r); document.body.appendChild(t);
    const vw = document.documentElement.clientWidth;
    if (box.x + t.offsetWidth > vw - 8) {
      t.style.left = `${Math.max(4, box.x + sx + box.width + 6 - t.offsetWidth)}px`;
      t.style.top = `${box.y + sy + box.height + 12}px`;
    }
  }, { box, text, color });
}
async function annotate(page, locator, text, color) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const box = await locator.boundingBox();
  if (!box) throw new Error('sin boundingBox para anotar: ' + text);
  await annotateBox(page, box, text, color);
}
async function banner(page, text) {
  await page.evaluate((text) => {
    const b = document.createElement('div');
    b.className = 'qa-annot';
    b.textContent = text;
    Object.assign(b.style, { position: 'fixed', right: '200px', top: '40px', background: 'rgba(20,83,45,.95)', color: '#fff', font: '12px/1.4 Consolas, monospace', padding: '8px 12px', borderRadius: '6px', zIndex: 2147483647, whiteSpace: 'pre' });
    document.body.appendChild(b);
  }, text);
}
const clearAnnot = (page) => page.evaluate(() => document.querySelectorAll('.qa-annot').forEach((n) => n.remove()));
const stamp = () => new Date().toLocaleString('es-GT');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
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
  const meta = (bug, tc, extra = '') => banner(page, `REGRESIÓN ${bug} · ${tc}\nQA local · BD proyecto_graduacion_qa · ${stamp()}${extra ? '\n' + extra : ''}`);
  const visibleError = () => page.locator('p.feedback.error:visible').first();

  if (want('cli')) {
    await home('Clientes');
    await page.getByRole('button', { name: '+ Agregar cliente' }).click();
    await page.getByLabel('Nombre comercial *').fill('Cliente QA Duplicado (UI)');
    await page.getByLabel('Departamento').selectOption('Guatemala');
    await page.getByLabel('Municipio').fill('Guatemala');
    await page.getByLabel('Zona').fill('10');
    await page.getByPlaceholder('NIT facturacion').fill(ids.cli.nit);
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    const err = visibleError();
    await err.waitFor();
    await page.waitForTimeout(3000);
    await annotate(page, err, 'CORREGIDO: el sistema rechaza el NIT repetido (HTTP 409) y no crea el cliente');
    await meta('BUG-CLI-01', 'TC-REQ001-005');
    await shot('Evidencia_BUG-CLI-01_regresion.png');
  }

  if (want('pro1')) {
    await home('Produccion');
    const row = page.getByRole('row').filter({ hasText: ids.pro1.codigo }).first();
    await row.waitFor();
    await row.getByRole('button', { name: 'Gestionar' }).click();
    const detail = page.locator('.inline-detail-view');
    await detail.waitFor();
    await page.waitForTimeout(1000);
    const corte = detail.getByRole('row').filter({ hasText: 'Corte' }).first();
    await corte.getByRole('button', { name: 'Registrar merma' }).click();
    const form = page.locator('form', { has: page.locator('select[name="id_tipo_merma"]') }).last();
    await form.waitFor();
    await form.locator('select[name="id_tipo_merma"]').selectOption({ index: 1 });
    await form.locator('input[name="cantidad_kg"]').fill('60');
    await form.getByRole('button', { name: 'Registrar merma' }).click();
    const err = page.locator('.modal-backdrop').last().locator('p.feedback.error').first();
    await err.waitFor();
    await page.waitForTimeout(3000);
    await annotate(page, err, 'CORREGIDO: merma de 60 kg rechazada, supera la entrada de 50 kg de la etapa Corte');
    await meta('BUG-PRO-01', 'TC-REQ003-002', `Proceso ${ids.pro1.codigo}`);
    await shot('Evidencia_BUG-PRO-01_regresion.png');
  }

  if (want('rep1')) {
    await home('Pedidos');
    await page.getByRole('tab', { name: 'Reportes', exact: true }).click();
    await page.waitForTimeout(700);
    const btn = page.getByRole('button', { name: /Descargar Excel/ });
    const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);
    await page.waitForTimeout(500);
    await annotate(page, btn, `CORREGIDO: nueva opción "Descargar Excel" → ${download.suggestedFilename()}`);
    await meta('BUG-REP-01', 'TC-REQ005-003');
    await shot('Evidencia_BUG-REP-01_regresion.png');
    console.log('XLSX', file);
  }

  if (want('rep2')) {
    await home('Trazabilidad');
    await page.getByRole('button', { name: 'Busqueda avanzada por fechas' }).click();
    const dates = page.locator('input[type="date"]');
    await dates.nth(1).waitFor();
    await dates.nth(0).fill('2026-10-15');
    await dates.nth(1).fill('2026-10-10');
    await page.getByRole('button', { name: /Buscar por filtros/ }).click();
    const err = visibleError();
    await err.waitFor();
    await annotate(page, err, 'CORREGIDO: la búsqueda con Desde 15/10/2026 > Hasta 10/10/2026 se rechaza con aviso');
    await meta('BUG-REP-02', 'TC-REQ005-004', 'API: GET /api/trazabilidad/filtrar → HTTP 400');
    await shot('Evidencia_BUG-REP-02_regresion.png');
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
