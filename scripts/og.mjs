#!/usr/bin/env node
/**
 * Tras `vite build`: una copia de dist/index.html por sección y por ficha, con
 * sus etiquetas Open Graph. Lo llama `npm run build` (y build:pages con --base).
 *
 *   node scripts/og.mjs [--dist dist] [--base /] [--sitio https://...]
 *
 * El sitio absoluto sale de CO_SITE_URL o de --sitio; sin ninguno, el dominio
 * propio. Open Graph exige URLs absolutas: sin ellas no hay vista previa.
 *
 * La lógica está en scripts/lib/og.mjs; aquí, disco y la carga de
 * src/data/contentTypes.js (que importa los modales .jsx, así que se compila al
 * vuelo con esbuild sustituyéndolos por nada — sólo hacen falta slug y textos).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { metasDe, inyectar, rutaSalida, SITIO_POR_DEFECTO } from './lib/og.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const arg = (nombre, defecto) => {
  const i = process.argv.findIndex((a) => a === nombre || a.startsWith(`${nombre}=`));
  if (i === -1) return defecto;
  const a = process.argv[i];
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : (process.argv[i + 1] ?? defecto);
};

export async function cargarTipos(raiz = RAIZ) {
  const cache = resolve(raiz, 'node_modules/.cache/co-render');
  mkdirSync(cache, { recursive: true });
  const salida = join(cache, 'contentTypes.mjs');
  await build({
    entryPoints: [resolve(raiz, 'src/data/contentTypes.js')],
    outfile: salida,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    plugins: [{
      name: 'sin-modales',
      setup(b) {
        b.onResolve({ filter: /\/components\// }, (a) => ({ path: a.path, namespace: 'nada' }));
        b.onLoad({ filter: /.*/, namespace: 'nada' }, () => ({ contents: 'export default null;' }));
      },
    }],
  });
  const { CONTENT_TYPES, CONTENT_TYPE_ORDER } = await import(pathToFileURL(salida).href);
  return CONTENT_TYPE_ORDER.map((id) => CONTENT_TYPES[id]);
}

/**
 * Escribe las páginas. Devuelve las rutas escritas (relativas a dist).
 * `leerDatos(file)` y `tipos` se inyectan para poder probarlo sin la web real.
 */
export async function generar({ dist, base = '/', sitio = SITIO_POR_DEFECTO, tipos, leerDatos }) {
  const plantilla = await readFile(resolve(dist, 'index.html'), 'utf8');
  if (!plantilla.includes('</head>')) throw new Error(`${dist}/index.html no parece el index compilado`);
  const escritas = [];
  for (const tipo of tipos) {
    const paginas = [[rutaSalida(tipo), metasDe({ tipo, sitio, base })]];
    const datos = await leerDatos(tipo.file);
    for (const item of datos.items ?? []) {
      if (item?.id === undefined || item?.id === null || !item.title) continue;
      paginas.push([rutaSalida(tipo, item), metasDe({ tipo, item, sitio, base })]);
    }
    for (const [ruta, metas] of paginas) {
      const destino = resolve(dist, ruta);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, inyectar(plantilla, metas), 'utf8');
      escritas.push(ruta);
    }
  }
  return escritas;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(RAIZ, arg('--dist', 'dist'));
  const base = arg('--base', '/');
  const sitio = process.env.CO_SITE_URL || arg('--sitio', SITIO_POR_DEFECTO);
  const tipos = await cargarTipos();
  const leerDatos = async (file) => JSON.parse(await readFile(resolve(dist, 'data', file), 'utf8'));
  const escritas = await generar({ dist, base, sitio, tipos, leerDatos });
  console.log(`  OG: ${escritas.length} páginas con vista previa en ${dist} (${sitio}${base})`);
}
