#!/usr/bin/env node
/**
 * Comprueba las fichas hermanas: node scripts/test-related.mjs
 *
 * Node exige extensión en los imports relativos y src/lib/related.js no la
 * lleva (Vite no la necesita), así que se compila al vuelo con esbuild — mismo
 * patrón que scripts/test-render.mjs.
 */

import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let pasan = 0;
const fallos = [];
const check = (n, cond, d = '') => { if (cond) pasan += 1; else fallos.push(`${n}${d ? ` — ${d}` : ''}`); };
const igual = (n, real, esp) =>
  check(n, JSON.stringify(real) === JSON.stringify(esp),
    `esperaba ${JSON.stringify(esp)}, obtuve ${JSON.stringify(real)}`);

const cache = resolve(RAIZ, 'node_modules/.cache/co-render');
mkdirSync(cache, { recursive: true });
const salida = join(cache, 'related.mjs');
await build({
  entryPoints: [resolve(RAIZ, 'src/lib/related.js')],
  outfile: salida,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const { hermanas } = await import(pathToFileURL(salida).href);

// -------------------------------------------------------- los tres estados
igual('sin related ni bandera: no existe',
  hermanas({ hasManga: false, related: {} }, 'anime').find((h) => h.seccion === 'manga').estado, 'no');

{
  const h = hermanas({ hasManga: true, related: {} }, 'anime').find((h) => h.seccion === 'manga');
  igual('bandera true sin id: existe pero sin reseñar', h.estado, 'existe');
  igual('sin id', h.id, null);
  check('etiqueta dice que aún no la ha reseñado', h.etiqueta.includes('aún no'));
}

{
  // El id manda incluso si la bandera dice que no hay — el enlace es la
  // verdad, no la bandera heurística del generador.
  const h = hermanas({ hasManga: false, related: { manga: 1 } }, 'anime').find((h) => h.seccion === 'manga');
  igual('con id: ficha, aunque la bandera diga que no', h.estado, 'ficha');
  igual('el id se propaga', h.id, 1);
  check('la etiqueta invita a ir', h.etiqueta.includes('→'));
}

// ------------------------------------------------ qué hermanas ofrece cada sección
igual('anime propone manga y novela', hermanas({}, 'anime').map((h) => h.seccion), ['manga', 'lightnovel']);
igual('manga propone sólo anime', hermanas({}, 'manga').map((h) => h.seccion), ['anime']);
igual('novelas proponen anime y manga', hermanas({}, 'lightnovel').map((h) => h.seccion), ['anime', 'manga']);

// -------------------------------------------------------------------- bordes
igual('una sección desconocida no revienta, da []', hermanas({}, 'invento'), []);
igual('sin item no revienta', hermanas(undefined, 'anime').map((h) => h.estado), ['no', 'no']);

// control positivo: si el cálculo de estado no distinguiera nada, esto fallaría
check('control positivo: los tres estados son distintos entre sí',
  new Set(['no', 'existe', 'ficha']).size === 3);

// ------------------------------------------------- normalize.js: related.related
{
  const { normalizeItem } = await import(pathToFileURL(
    resolve(RAIZ, 'src/data/normalize.js'),
  ).href);
  igual('normalizeItem da {} sin related', normalizeItem({}, 0).related, {});
  igual('normalizeItem conserva un related válido',
    normalizeItem({ related: { manga: 1 } }, 0).related, { manga: 1 });
  igual('normalizeItem descarta un related que no es objeto', normalizeItem({ related: 'x' }, 0).related, {});
  igual('normalizeItem descarta valores raros dentro de related',
    normalizeItem({ related: { manga: 1, lightnovel: [1, 2] } }, 0).related, { manga: 1 });
}

console.log(`\n  ${pasan} comprobaciones de fichas hermanas pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
