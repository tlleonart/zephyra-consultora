#!/usr/bin/env node
/**
 * verificar-produccion — el chequeo de humo del día del pase a producción.
 *
 * POR QUÉ EXISTE. Un despliegue se verifica **por HTTP contra el dominio real**,
 * nunca por la salida del comando que lo publicó. Ya pasó una vez: se dio por
 * desplegado algo que no estaba, y se descubrió dos días después.
 *
 * QUÉ MIRA, y por qué cada cosa:
 *   1. Que las rutas públicas respondan (y que el catálogo tenga cursos: en un
 *      Convex recién estrenado está vacío y la página igual devuelve 200).
 *   2. Que el bundle apunte al Convex de PRODUCCIÓN y no al de staging. Es el
 *      error más caro y el más invisible: la web anda, y las compras y el
 *      progreso caen en la base equivocada.
 *   3. Que la ruta protegida del reproductor siga protegida.
 *   4. Que los enlaces entre los dos sitios crucen bien (ACADEMIA ↔ Zephyra).
 *   5. Que producción NO esté marcada como "no indexar" y que staging SÍ lo esté,
 *      si se decidió separarlos.
 *   6. Cabeceras de seguridad y HTTPS.
 *
 * QUÉ NO PUEDE MIRAR, y hay que hacer a mano: la compra real con plata de
 * verdad y el webhook de MercadoPago. Eso es el paso manual del runbook.
 *
 * Uso:
 *   node ops/verificar-produccion.mjs --academia https://... --www https://... \
 *        [--convex https://<deployment>.convex.cloud] [--staging]
 */

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const ACADEMIA = (opt('academia') || '').replace(/\/$/, '');
const WWW = (opt('www') || '').replace(/\/$/, '');
const CONVEX_ESPERADO = opt('convex');
const ES_STAGING = flag('staging');

if (!ACADEMIA || !WWW) {
  console.error('Faltan --academia y --www. Ver el encabezado de este archivo.');
  process.exit(2);
}

const resultados = [];
const ok = (nombre, pasa, detalle = '') =>
  resultados.push({ nombre, pasa, detalle });

const traer = async (url, opciones = {}) => {
  const r = await fetch(url, { redirect: 'manual', ...opciones });
  const cuerpo = r.status < 400 ? await r.text() : '';
  return { status: r.status, headers: r.headers, cuerpo, location: r.headers.get('location') };
};

const main = async () => {
  // 1 · Rutas públicas
  for (const ruta of ['/', '/cursos', '/empresa', '/empresa/registro', '/cursos/auth/signin']) {
    const r = await traer(ACADEMIA + ruta);
    ok(`academia ${ruta} responde`, r.status === 200, `HTTP ${r.status}`);
  }
  for (const ruta of ['/', '/contacto']) {
    const r = await traer(WWW + ruta);
    ok(`www ${ruta} responde`, r.status === 200, `HTTP ${r.status}`);
  }

  // 1b · El catálogo tiene cursos de verdad. Una base vacía devuelve 200 igual.
  const catalogo = await traer(ACADEMIA + '/cursos');
  const tieneCursos = /href="\/cursos\/[a-z0-9-]+"/.test(catalogo.cuerpo);
  ok('el catálogo muestra al menos un curso', tieneCursos,
    tieneCursos ? '' : 'la base de producción puede estar vacía');

  // 2 · ¿A qué Convex apunta el bundle servido?
  const chunks = [...new Set([...catalogo.cuerpo.matchAll(/\/_next\/static\/[^"]+\.js/g)].map((m) => m[0]))];
  const origenes = new Set();
  for (const c of chunks.slice(0, 30)) {
    const r = await traer(ACADEMIA + c);
    for (const m of r.cuerpo.matchAll(/https:\/\/[a-z0-9-]+\.convex\.cloud/g)) origenes.add(m[0]);
  }
  const listados = [...origenes].join(', ') || '(ninguno encontrado)';
  if (CONVEX_ESPERADO) {
    ok('el bundle apunta al Convex esperado', origenes.has(CONVEX_ESPERADO.replace(/\/$/, '')), listados);
  } else {
    ok('Convex que usa el sitio (informativo)', true, listados);
  }

  // 3 · La ruta del reproductor sigue protegida
  const player = await traer(`${ACADEMIA}/cursos/cualquier-cosa/player`);
  ok('el reproductor exige sesión', player.status === 307 || player.status === 302,
    `HTTP ${player.status} → ${player.location ?? '—'}`);

  // 4 · Los dos sitios se enlazan
  const home = await traer(ACADEMIA + '/');
  ok('academia enlaza al sitio institucional', home.cuerpo.includes(WWW), WWW);
  const wwwHome = await traer(WWW + '/');
  ok('el índice principal enlaza a ACADEMIA', wwwHome.cuerpo.includes(ACADEMIA), ACADEMIA);

  // 5 · Indexación
  const robots = await traer(ACADEMIA + '/robots.txt');
  const noindex = /noindex/i.test(home.headers.get('x-robots-tag') || '') ||
    /<meta[^>]+noindex/i.test(home.cuerpo);
  if (ES_STAGING) {
    ok('staging NO se indexa', noindex || /Disallow:\s*\//.test(robots.cuerpo),
      'sin esto, staging compite con producción en Google');
  } else {
    ok('producción SÍ se indexa', !noindex, noindex ? 'quedó el noindex de staging puesto' : '');
  }

  // 6 · HTTPS y cabeceras
  ok('academia es HTTPS', ACADEMIA.startsWith('https://'), ACADEMIA);
  const cabeceras = ['strict-transport-security', 'x-content-type-options', 'x-frame-options'];
  for (const h of cabeceras) {
    ok(`cabecera ${h}`, !!home.headers.get(h), home.headers.get(h) ?? 'ausente');
  }

  // Informe
  const fallan = resultados.filter((r) => !r.pasa);
  for (const r of resultados) {
    console.log(`${r.pasa ? 'OK  ' : 'FALLA'}  ${r.nombre}${r.detalle ? '  — ' + r.detalle : ''}`);
  }
  console.log(`\n${resultados.length - fallan.length}/${resultados.length} verificaciones pasaron.`);
  if (fallan.length) {
    console.log('\nPENDIENTE A MANO, que esto no puede verificar:');
    console.log('  · una compra real de punta a punta, con plata de verdad;');
    console.log('  · que el webhook de MercadoPago llegue y otorgue el acceso;');
    console.log('  · el reembolso de esa compra.');
    process.exit(1);
  }
  console.log('\nFalta igual el paso manual: una compra real, el webhook, y su reembolso.');
};

main().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(2);
});
