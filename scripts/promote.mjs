#!/usr/bin/env node
/**
 * Promociona un borrador de la rama `borradores` a public/data/anime.json.
 *
 *   git fetch casa
 *   node scripts/promote.mjs 162804 --categoria "Viendo"
 *
 * Lee el borrador con `git show`, NO con checkout: así no te queda un directorio
 * drafts/ en el índice de main esperando a que un `git add .` distraído lo suba.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'public/data/anime.json');
const REMOTO = process.env.CO_REMOTO || 'casa';
const RAMA = 'borradores';

// Las categorías salen del propio JSON, no de una lista repetida aquí.
const CATEGORIAS = JSON.parse(readFileSync(DESTINO, 'utf8')).categories;

const morir = (msg) => {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const anilistId = args.find((a) => /^\d+$/.test(a));
const iCat = args.indexOf('--categoria');
const categoria = iCat >= 0 ? args[iCat + 1] : null;

if (!anilistId) {
  console.error(`
  Uso: node scripts/promote.mjs <idAniList> --categoria "<categoría>"

  Categorías válidas: ${CATEGORIAS.map((c) => `"${c}"`).join(', ')}

  Para ver qué borradores hay pendientes:
    git fetch ${REMOTO} && git show ${REMOTO}/${RAMA}:drafts/PENDIENTES.md
`);
  process.exit(1);
}

// La categoría es obligatoria a propósito. Sin ella habría que inventarse un
// "No visto" provisional que miente, o dejarla vacía y que la ficha desaparezca
// en silencio de la web. Es la primera decisión, y es tuya.
if (!categoria) morir('falta --categoria. Es tuya: nadie puede deducir si lo has visto.');
if (!CATEGORIAS.includes(categoria)) {
  morir(`categoría "${categoria}" desconocida. Válidas: ${CATEGORIAS.join(', ')}`);
}

// ---------------------------------------------------------------- el borrador
let borrador;
try {
  const crudo = execFileSync(
    'git',
    ['show', `${REMOTO}/${RAMA}:drafts/anime/${anilistId}.json`],
    { cwd: RAIZ, encoding: 'utf8' },
  );
  borrador = JSON.parse(crudo);
} catch {
  morir(
    `no hay borrador para ${anilistId} en ${REMOTO}/${RAMA}.\n` +
      `         ¿Has hecho 'git fetch ${REMOTO}'?\n` +
      `         Pendientes: git show ${REMOTO}/${RAMA}:drafts/PENDIENTES.md`,
  );
}

// ---------------------------------------------------------------- validación
const datos = JSON.parse(readFileSync(DESTINO, 'utf8'));

// Idempotencia por FRANQUICIA, no por anime: si ya publicaste la temporada 1,
// la 2 no crea una ficha nueva.
const idsBorrador = new Set(borrador._meta?.anilistIds ?? [Number(anilistId)]);
const yaEsta = datos.items.find((it) =>
  (it.anilistIds ?? []).some((id) => idsBorrador.has(id)),
);
if (yaEsta) {
  morir(
    `esta franquicia ya está en la web como «${yaEsta.title}» (id ${yaEsta.id}).\n` +
      `         Si querías actualizarla, edítala a mano: promote.mjs solo añade.`,
  );
}

for (const campo of ['title', 'japaneseTitle', 'genres']) {
  if (!borrador[campo] || borrador[campo].length === 0) {
    morir(`el borrador no tiene ${campo}. Revísalo antes de promocionarlo.`);
  }
}

// ---------------------------------------------------------------- inserción
const { _meta, ...ficha } = borrador;

// App.jsx ordena con (a.id - b.id): tiene que ser número, no cadena.
ficha.id = Math.max(0, ...datos.items.map((i) => Number(i.id) || 0)) + 1;
ficha.category = categoria;
ficha.anilistIds = _meta.anilistIds;

// Orden de claves estable, para que el diff de git sea legible.
const ORDEN = [
  'id', 'title', 'japaneseTitle', 'category', 'image', 'description', 'genres',
  'fullSynopsis', 'episodes', 'hasManga', 'hasLightNovel', 'willReadSource',
  'doIRecommend', 'platforms', 'languages', 'rating', 'ratingFinal',
  'personalOpinion', 'personalOpinionFinal', 'openings', 'endings', 'anilistIds',
];
const ordenada = {};
for (const k of ORDEN) if (k in ficha) ordenada[k] = ficha[k];
for (const k of Object.keys(ficha)) if (!(k in ordenada)) ordenada[k] = ficha[k];

datos.items.push(ordenada);

// Escritura atómica: si esto se corta a la mitad, no quieres un anime.json roto.
const tmp = `${DESTINO}.tmp`;
writeFileSync(tmp, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
renameSync(tmp, DESTINO);

// ---------------------------------------------------------------- resumen
const vacios = ['rating', 'ratingFinal', 'personalOpinion', 'personalOpinionFinal',
  'doIRecommend', 'willReadSource'].filter((c) => !ordenada[c]);

console.log(`
  Añadida «${ordenada.title}» como ficha ${ordenada.id}, categoría "${categoria}".

  Revisar (la máquina no puede saberlo):
    ${(_meta._revisar ?? []).join(', ')}
${(_meta._avisos ?? []).length ? `\n  Avisos del generador:\n    ${_meta._avisos.join('\n    ')}` : ''}
  Te toca escribir:
    ${vacios.join(', ')}

  Cuando lo tengas:
    git add public/data/anime.json && git commit && git push casa main
`);
