// Genera una imagen por bug con el extracto real de qa_environment_error.log (peticiones/respuestas HTTP).
// Uso: node log_shots.cjs <FRONTEND_NODE_MODULES> <LOG_PATH> <OUT_DIR>
const path = require('path');
const fs = require('fs');
const [NM, LOG, OUT] = process.argv.slice(2);
const { chromium } = require(path.join(NM, 'playwright'));

const text = fs.readFileSync(LOG, 'utf8');
const header = text.split('\n').slice(0, 5).filter((l) => l.trim() && !/^=+$/.test(l.trim())).map((l) => l.trim());
const sections = {};
let current = null;
for (const line of text.split('\n')) {
  const m = line.match(/^--- (BUG-[A-Z]+-\d+) · (.*) ---$/);
  if (m) { current = m[1]; sections[current] = { title: m[2], lines: [] }; continue; }
  if (/^--- /.test(line) || /^Fin de la ejecución/.test(line)) { current = null; continue; }
  if (current && line.trim()) sections[current].lines.push(line);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wrapJson = (s, max = 150) => (s.length > max ? s.slice(0, max) + ' …' : s);

const DEFECT_CALL = {
  'BUG-CLI-01': (c, r) => c.includes('POST /api/clientes') && r.includes('Duplicado'),
  'BUG-REC-01': (c) => c.includes('/units'),
  'BUG-PRO-01': (c) => c.includes('/mermas'),
  'BUG-PRO-02': (c, r) => c.includes('/finalizar') && r.includes('"justificacion_diferencia":"   "'),
  'BUG-REP-02': (c) => c.includes('] GET '),
};
let lastCall = "", lastReq = "", currentBug = "";
function lineHtml(l) {
  let cls = '';
  let body = l;
  if (/^\s*response: HTTP (\d+)/.test(l)) {
    const code = Number(l.match(/HTTP (\d+)/)[1]);
    const isDefect = (DEFECT_CALL[currentBug] || (() => false))(lastCall, lastReq);
    cls = code >= 400 ? 'resp-ok' : isDefect ? 'resp-bad' : 'resp';
    body = wrapJson(l);
  } else if (/^\s*request :/.test(l)) {
    cls = 'req';
    lastReq = l;
  } else if (/RESULTADO/.test(l)) cls = /CORREGIDO/.test(l) ? 'result result-fixed' : 'result';
  else if (/verificación|preparación|control:/.test(l)) cls = 'note';
  else if (/^\[/.test(l)) { cls = 'call'; lastCall = l; lastReq = ''; }
  return `<div class="l ${cls}">${esc(body)}</div>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 400 }, deviceScaleFactor: 1.5 });
  for (const [bug, sec] of Object.entries(sections)) {
    currentBug = bug;
    // sin llamadas a la API ni verificaciones que mostrar (BUG-REP-01 en el log original)
    if (!sec.lines.some((l) => /HTTP \d+|verificación/.test(l))) continue;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0f172a;font:13px/1.5 Consolas,'Courier New',monospace;color:#cbd5e1}
      .bar{background:#1e293b;padding:10px 16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #334155}
      .dot{width:12px;height:12px;border-radius:50%}.t{margin-left:10px;color:#e2e8f0;font-weight:600}
      .meta{padding:10px 16px 0;color:#94a3b8;font-size:12px}
      .h{padding:6px 16px 10px;color:#f8fafc;font-weight:700;font-size:14px;border-bottom:1px dashed #334155}
      .body{padding:10px 16px 16px}.l{white-space:pre-wrap;word-break:break-word}
      .call{color:#7dd3fc;margin-top:6px}.req{color:#cbd5e1}.resp-bad{color:#fecaca;background:rgba(225,29,72,.18);border-left:3px solid #e11d48;padding-left:6px}
      .resp{color:#94a3b8;padding-left:9px}.resp-ok{color:#bbf7d0;background:rgba(34,197,94,.12);border-left:3px solid #22c55e;padding-left:6px}
      .note{color:#fde68a}.result{color:#fff;background:#e11d48;font-weight:700;padding:4px 8px;margin-top:8px;border-radius:4px}.result-fixed{background:#16a34a}
      .legend{padding:0 16px 14px;color:#94a3b8;font-size:11px}
    </style>
    <div class="bar"><span class="dot" style="background:#ef4444"></span><span class="dot" style="background:#f59e0b"></span><span class="dot" style="background:#22c55e"></span>
      <span class="t">Logs_Consola_Servidor/${path.basename(LOG)} — ${bug}</span></div>
    <div class="meta">${header.map(esc).join('<br>')}</div>
    <div class="h">${bug} · ${esc(sec.title)}</div>
    <div class="body">${sec.lines.map(lineHtml).join('')}</div>
    <div class="legend">Rojo: respuesta que acepta el dato inválido (defecto) · Verde: respuesta de control que sí valida · Gris: preparación de datos · Extracto literal del log; respuestas largas recortadas con “…”.</div>`;
    await page.setContent(html);
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 1280, height: h });
    await page.screenshot({ path: path.join(OUT, `Evidencia_${bug}_API${process.env.SUFFIX || ''}.png`), fullPage: true });
    console.log('ok', bug);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
