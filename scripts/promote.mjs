#!/usr/bin/env node
/**
 * Promociona un borrador de la rama `borradores` a public/data/<sección>.json.
 *
 *   git fetch casa
 *   node scripts/promote.mjs 162804 --categoria "Viendo"
 *   node scripts/promote.mjs 105778 --seccion manga --categoria "Leyendo"
 *
 * Lee el borrador con `git show`, NO con checkout: así no te queda un directorio
 * drafts/ en el índice de main esperando a que un `git add .` distraído lo suba.
 *
 * La lógica de promoción vive en panel/lib/promover.mjs, compartida con el panel.
 * Antes estaba aquí duplicada, y dos caminos que escriben lo mismo acaban
 * divergiendo.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promover } from '../panel/lib/promover.mjs';
import { seccion, CLAVES } from '../panel/lib/secciones.mjs';
import { serializar } from '../panel/lib/aplicar.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REMOTO = process.env.CO_REMOTO || 'casa';
const RAMA = 'borradores';

const morir = (msg) => {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------- argumentos
// La sección se lee ANTES que nada: de ella salen el fichero de destino, la
// carpeta de borradores y las categorías válidas. Antes el destino estaba fijado
// a anime.json en la línea 18 y las categorías se leían al cargar el módulo,
// antes incluso de mirar los argumentos.
const args = process.argv.slice(2);
const valor = (bandera) => {
  const i = args.indexOf(bandera);
  return i >= 0 ? args[i + 1] : null;
};

const anilistId = args.find((a) => /^\d+$/.test(a));
const clave = valor('--seccion') || 'anime';
const categoria = valor('--categoria');

if (!CLAVES.includes(clave)) {
  morir(`sección "${clave}" desconocida. Válidas: ${CLAVES.join(', ')}.`);
}

const s = seccion(clave);
const DESTINO = resolve(RAIZ, s.fichero);

if (!anilistId) {
  const categorias = JSON.parse(readFileSync(DESTINO, 'utf8')).categories ?? [];
  console.error(`
  Uso: node scripts/promote.mjs <idAniList> [--seccion ${CLAVES.join('|')}] --categoria "<categoría>"

  Sección actual: ${clave} -> ${s.fichero}
  Categorías válidas: ${categorias.map((c) => `"${c}"`).join(', ')}

  Para ver qué borradores hay pendientes:
    git fetch ${REMOTO} && git show ${REMOTO}/${RAMA}:drafts/PENDIENTES.md

  O ábrelos en el panel, que además los enseña con lo que propuso la máquina.
`);
  process.exit(1);
}

// ---------------------------------------------------------------- el borrador
let borrador;
try {
  const crudo = execFileSync(
    'git',
    ['show', `${REMOTO}/${RAMA}:${s.drafts}/${anilistId}.json`],
    { cwd: RAIZ, encoding: 'utf8' },
  );
  borrador = JSON.parse(crudo);
} catch {
  morir(
    `no hay borrador para ${anilistId} en ${REMOTO}/${RAMA} (${s.drafts}/).\n` +
      `         ¿Has hecho 'git fetch ${REMOTO}'?\n` +
      `         Pendientes: git show ${REMOTO}/${RAMA}:drafts/PENDIENTES.md`,
  );
}

// ---------------------------------------------- promoción (compartida con el panel)
const datos = JSON.parse(readFileSync(DESTINO, 'utf8'));

let resultado;
try {
  resultado = promover(datos, borrador, { categoria, clave });
} catch (e) {
  morir(e.message);
}

// Escritura atómica: si esto se corta a la mitad, no quieres un JSON roto.
const tmp = `${DESTINO}.tmp`;
writeFileSync(tmp, serializar(resultado.datos), 'utf8');
renameSync(tmp, DESTINO);

// ---------------------------------------------------------------- resumen
const { ficha, revisar, avisos } = resultado;
const vacios = s.campos
  .map((c) => c.clave)
  .filter((c) => c !== 'category' && !ficha[c]);

console.log(`
  Añadida «${ficha.title}» como ficha ${ficha.id} de ${clave}, categoría "${categoria}".

  Revisar (la máquina no puede saberlo):
    ${revisar.join(', ') || '(nada)'}
${avisos.length ? `\n  Avisos del generador:\n    ${avisos.join('\n    ')}\n` : ''}
  Te toca escribir:
    ${vacios.join(', ')}

  Cuando lo tengas:
    npm run deploy
`);
