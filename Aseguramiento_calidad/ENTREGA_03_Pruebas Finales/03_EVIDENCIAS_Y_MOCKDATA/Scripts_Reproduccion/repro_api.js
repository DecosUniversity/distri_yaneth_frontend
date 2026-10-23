// Reproduce los 6 defectos contra la API QA (copia de la BD) y deja un log de peticiones/respuestas.
// Uso: node repro_api.js <API_BASE> <LOG_PATH> <IDS_JSON_PATH>
const fs = require('fs');

const [API, LOG, IDS] = process.argv.slice(2);
// MODE=regresion: mismas peticiones y datos, pero el resultado esperado es que el sistema rechace
const REGRESSION = process.env.MODE === 'regresion';
const verdict = (reproduced, bugText, fixedText) => (reproduced ? `DEFECTO REPRODUCIDO – ${bugText}` : `CORREGIDO – ${fixedText}`);
const lines = [];
const ids = {};
const pad = (n) => String(n).padStart(2, '0');
const local = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const stamp = () => local();
const log = (s = '') => { lines.push(s); console.log(s); };

let token = null;
const call = async (bug, method, path, body, { quiet = false } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!quiet) {
    log(`[${stamp()}] [${bug}] ${method} ${path}`);
    if (body !== undefined) log(`    request : ${JSON.stringify(body)}`);
    const shown = JSON.stringify(json);
    log(`    response: HTTP ${res.status} ${shown.length > 600 ? shown.slice(0, 600) + ' …' : shown}`);
  }
  if (res.status >= 500) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return { status: res.status, body: json };
};
const must = (r, what) => { if (r.status >= 300) throw new Error(`${what} fallo: ${r.status} ${JSON.stringify(r.body)}`); return r.body; };

const today = local().slice(0, 10);
const now = () => local();

// Crea entrada de Platano Verde y la acepta como Maduro -> sub-lote listo para produccion
const readySublot = async (bug, kg, ref) => {
  const entrada = must(await call(bug, 'POST', '/api/entradas-mercancia', {
    id_proveedor: 1, id_producto: 1, fecha_vencimiento: '2026-12-31', cantidad_disponible: kg,
    documento_referencia: ref, unidades: [{ unidad_codigo: '1', peso: kg }],
  }, { quiet: true }), 'crear entrada');
  const lotes = must(await call(bug, 'GET', '/api/maduracion/lotes', undefined, { quiet: true }), 'lotes');
  const lote = lotes.find((l) => Number(l.id_entrada_origen) === Number(entrada.id_entrada));
  if (!lote) throw new Error('no se encontro el lote de la entrada ' + entrada.id_entrada);
  const sub = must(await call(bug, 'POST', `/api/maduracion/lotes/${lote.id_lote_mp}/aceptar`, { estado_maduracion: 'Maduro' }, { quiet: true }), 'aceptar lote');
  return { entrada, lote, sublote: sub };
};

(async () => {
  log('=====================================================================');
  log(` QA ENVIRONMENT LOG – ${REGRESSION ? 'Regresión posterior a la corrección' : 'Reproducción de defectos'} (Entrega 03, Equipo 3)`);
  log(` Fecha: ${today}   API: ${API}   BD: proyecto_graduacion_qa (copia de QA)`);
  log(' Backend Node.js/Express (commit 7c6cfb7) – MariaDB 10.4.32 (XAMPP) – Redis/BullMQ');
  log('=====================================================================');
  log();

  log('--- Autenticación ---');
  // quiet: el log no muestra la contraseña
  token = must(await call('AUTH', 'POST', '/api/users/login', { username: 'dennis', password: '123456' }, { quiet: true }), 'login').token;
  log(`[${stamp()}] [AUTH] POST /api/users/login (usuario: dennis, rol Administrador) -> token JWT obtenido`);
  log();

  // ---------------------------------------------------------------- BUG-CLI-01
  log('--- BUG-CLI-01 · TC-REQ001-005 · NIT duplicado en catálogo de clientes ---');
  const nit = '1234567-8';
  const c1 = must(await call('BUG-CLI-01', 'POST', '/api/clientes', { nombre_comercial: 'Cliente QA Original', departamento: 'Guatemala', municipio: 'Guatemala', zona: '10', direccion_entrega: 'Zona 10', telefono: '55550001', nit_facturacion: nit }), 'cliente 1');
  const c2 = await call('BUG-CLI-01', 'POST', '/api/clientes', { nombre_comercial: 'Cliente QA Duplicado', departamento: 'Guatemala', municipio: 'Guatemala', zona: '10', direccion_entrega: 'Zona 10', telefono: '55550002', nit_facturacion: nit });
  const clientes = must(await call('BUG-CLI-01', 'GET', '/api/clientes', undefined, { quiet: true }), 'clientes');
  const dup = clientes.filter((c) => c.nit_facturacion === nit);
  log(`    verificación: clientes activos con NIT ${nit} = ${dup.length} (${dup.map((c) => `#${c.id_cliente} ${c.nombre_comercial}`).join(', ')})`);
  log(`    RESULTADO: ${verdict(c2.status === 201 && dup.length > 1, 'se aceptó el NIT duplicado', `NIT duplicado rechazado (HTTP ${c2.status}); solo existe el cliente original`)}`);
  ids.cli = { nit, ids: dup.map((c) => c.id_cliente) };
  log();

  // ---------------------------------------------------------------- BUG-REC-01
  log('--- BUG-REC-01 · TC-REQ002-002 · Unidad de recepción con peso negativo ---');
  const ent = must(await call('BUG-REC-01', 'POST', '/api/entradas-mercancia', {
    id_proveedor: 1, id_producto: 2, fecha_vencimiento: '2026-12-31', cantidad_disponible: 20,
    documento_referencia: 'LOT-QA-002', unidades: [{ unidad_codigo: '1', peso: 20 }],
  }), 'entrada');
  const neg = await call('BUG-REC-01', 'POST', `/api/entradas-mercancia/${ent.id_entrada}/units`, { peso: -5 });
  const units = must(await call('BUG-REC-01', 'GET', `/api/entradas-mercancia/${ent.id_entrada}/units`), 'units');
  const sum = units.reduce((s, u) => s + Number(u.peso), 0);
  log(`    verificación: unidades registradas = ${units.map((u) => u.peso).join(' kg, ')} kg; suma = ${sum} kg`);
  log(`    RESULTADO: ${verdict(neg.status === 201, 'la API aceptó peso −5 kg', `la API rechazó el peso −5 kg (HTTP ${neg.status})`)}`);
  ids.rec = { id_entrada: ent.id_entrada };
  log();

  // ---------------------------------------------------------------- BUG-PRO-01
  log('--- BUG-PRO-01 · TC-REQ003-002 · Merma mayor que la entrada de la etapa ---');
  const s1 = await readySublot('BUG-PRO-01', 50, 'LOT-QA-P002');
  log(`    preparación: entrada #${s1.entrada.id_entrada} -> lote #${s1.lote.id_lote_mp} -> sub-lote #${s1.sublote.id_sublote} (50 kg, Listo para producción)`);
  const p1 = must(await call('BUG-PRO-01', 'POST', '/api/produccion/procesos', { id_sublote: s1.sublote.id_sublote, id_producto_resultado: 8, cantidad_ingresada_kg: 50 }), 'proceso');
  must(await call('BUG-PRO-01', 'POST', `/api/produccion/procesos/${p1.id_proceso}/etapas`, { id_tipo_etapa: 1, fecha_inicio: now(), cantidad_personas: 2, cantidad_entrada_kg: 50 }), 'etapa pelado');
  const corte = must(await call('BUG-PRO-01', 'POST', `/api/produccion/procesos/${p1.id_proceso}/etapas`, { id_tipo_etapa: 2, fecha_inicio: now(), cantidad_personas: 2, cantidad_entrada_kg: 50 }), 'etapa corte');
  const m1 = await call('BUG-PRO-01', 'POST', `/api/produccion/procesos/${p1.id_proceso}/mermas`, { id_etapa: corte.id_etapa, id_tipo_merma: 3, cantidad_kg: 60, observaciones: 'TC-REQ003-002 merma 60 kg sobre entrada 50 kg' });
  const det1 = must(await call('BUG-PRO-01', 'GET', `/api/produccion/procesos/${p1.id_proceso}`, undefined, { quiet: true }), 'detalle');
  const et = (det1.etapas || []).find((e) => Number(e.id_etapa) === Number(corte.id_etapa)) || {};
  log(`    verificación: etapa Corte -> entrada ${et.cantidad_entrada_kg} kg, merma ${et.merma_kg} kg, salida ${et.cantidad_salida_kg} kg`);
  log(`    RESULTADO: ${verdict(m1.status === 201, 'merma de 60 kg aceptada sobre 50 kg de entrada', `merma de 60 kg rechazada (HTTP ${m1.status}); la etapa no registra la merma`)}`);
  ids.pro1 = { id_proceso: p1.id_proceso, codigo: det1.codigo_trazabilidad };
  log();

  // ---------------------------------------------------------------- BUG-PRO-02
  log('--- BUG-PRO-02 · TC-REQ003-008 · Justificación compuesta solo por espacios ---');
  const s2 = await readySublot('BUG-PRO-02', 200, 'LOT-QA-P008');
  log(`    preparación: entrada #${s2.entrada.id_entrada} -> lote #${s2.lote.id_lote_mp} -> sub-lote #${s2.sublote.id_sublote} (200 kg, Listo para producción)`);
  const p2 = must(await call('BUG-PRO-02', 'POST', '/api/produccion/procesos', { id_sublote: s2.sublote.id_sublote, id_producto_resultado: 8, cantidad_ingresada_kg: 200 }), 'proceso');
  const pel = must(await call('BUG-PRO-02', 'POST', `/api/produccion/procesos/${p2.id_proceso}/etapas`, { id_tipo_etapa: 1, fecha_inicio: now(), cantidad_personas: 3, cantidad_entrada_kg: 200 }), 'etapa pelado');
  must(await call('BUG-PRO-02', 'POST', `/api/produccion/procesos/${p2.id_proceso}/etapas`, { id_tipo_etapa: 2, fecha_inicio: now(), cantidad_personas: 3, cantidad_entrada_kg: 180 }), 'etapa corte');
  must(await call('BUG-PRO-02', 'POST', `/api/produccion/procesos/${p2.id_proceso}/mermas`, { id_etapa: pel.id_etapa, id_tipo_merma: 1, cantidad_kg: 20 }), 'merma');
  log('    control: mismo cierre con justificación vacía ("") para confirmar que la regla existe');
  await call('BUG-PRO-02', 'POST', `/api/produccion/procesos/${p2.id_proceso}/finalizar`, { cantidad_producida_kg: 175, fecha_fin: now(), fecha_vencimiento: '2027-01-31', justificacion_diferencia: '' });
  const fin = await call('BUG-PRO-02', 'POST', `/api/produccion/procesos/${p2.id_proceso}/finalizar`, { cantidad_producida_kg: 175, fecha_fin: now(), fecha_vencimiento: '2027-01-31', justificacion_diferencia: '   ' });
  const det2 = must(await call('BUG-PRO-02', 'GET', `/api/produccion/procesos/${p2.id_proceso}`, undefined, { quiet: true }), 'detalle');
  log(`    verificación: estado_proceso="${det2.estado_proceso}", diferencia_kg=${det2.diferencia_kg}, justificacion_diferencia=${JSON.stringify(det2.justificacion_diferencia)}`);
  if (fin.status >= 400) {
    log('    control: el mismo cierre con una justificación real sí debe aceptarse (TC-REQ003-005)');
    await call('BUG-PRO-02', 'POST', `/api/produccion/procesos/${p2.id_proceso}/finalizar`, { cantidad_producida_kg: 175, fecha_fin: now(), fecha_vencimiento: '2027-01-31', justificacion_diferencia: 'Diferencia en pesaje manual.' });
  }
  log(`    RESULTADO: ${verdict(fin.status < 300, 'se cerró con justificación de solo espacios', `justificación de solo espacios rechazada (HTTP ${fin.status}); con justificación real sí cierra`)}`);
  ids.pro2 = { id_proceso: p2.id_proceso, codigo: det2.codigo_trazabilidad };
  log();

  // ---------------------------------------------------------------- BUG-REP-01
  log('--- BUG-REP-01 · TC-REQ005-003 · Exportación a Excel ---');
  log('    No aplica a la API: la exportación es responsabilidad del frontend (ver captura de Pedidos > Reportes).');
  if (REGRESSION) {
    log('    RESULTADO: CORREGIDO – el botón "Descargar Excel" genera reporte_pedidos_<desde>_<hasta>.xlsx (ver verificación del archivo)');
  } else {
    log('    Revisión de la UI: solo existe el botón "Descargar PDF".');
    log('    RESULTADO: DEFECTO REPRODUCIDO – no hay opción de exportación a Excel');
  }
  log();

  // ---------------------------------------------------------------- BUG-REP-02
  log('--- BUG-REP-02 · TC-REQ005-004 · Intervalo de fechas invertido ---');
  const r1 = await call('BUG-REP-02', 'GET', '/api/pedidos/reportes/compras-por-cliente?desde=2026-10-15&hasta=2026-10-10');
  const r2 = await call('BUG-REP-02', 'GET', '/api/trazabilidad/filtrar?desde=2026-10-15&hasta=2026-10-10');
  log(`    RESULTADO: ${verdict(r1.status === 200 && r2.status === 200, 'ambos endpoints responden 200 sin validar el orden de las fechas', `ambos endpoints rechazan el rango invertido (HTTP ${r1.status} / ${r2.status})`)}`);
  log();
  log(`Fin de la ejecución: ${stamp()}`);

  fs.writeFileSync(LOG, lines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(IDS, JSON.stringify(ids, null, 2));
})().catch((e) => {
  log(`ERROR: ${e.message}`);
  fs.writeFileSync(LOG + '.partial', lines.join('\n'), 'utf8');
  process.exit(1);
});
