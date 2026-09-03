#!/usr/bin/env node
/**
 * Comprueba la bandeja de pendientes: node scripts/test-pendientes.mjs
 *
 * Sin red: las respuestas de AniList son fijas. Lo que se prueba es el cruce
 * entre lo que dice AniList que has visto y lo que ya tienes escrito.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  temporadasDe, filasPendientes, construirBandeja, interpretar, explicarError,
} from '../panel/lib/pendientes.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let pasan = 0;
const fallos = [];
const check = (n, cond, d = '') => { if (cond) pasan += 1; else fallos.push(`${n}${d ? ` — ${d}` : ''}`); };
const igual = (n, real, esp) =>
  check(n, JSON.stringify(real) === JSON.stringify(esp),
    `esperaba ${JSON.stringify(esp)}, obtuve ${JSON.stringify(real)}`);

// Formatos reales de Rent-a-Girlfriend, comprobados hoy contra AniList.
const FORMATOS = new Map([
  [113813, { format: 'TV', year: 2020 }],
  [124410, { format: 'TV', year: 2022 }],
  [154745, { format: 'TV', year: 2023 }],
  [179344, { format: 'ONA', year: 2025 }],
  [213581, { format: null, year: 0 }],
]);
const IDS = [113813, 124410, 154745, 179344, 213581];

// ------------------------------------------------------------ numerar temporadas
{
  const t = temporadasDe(IDS, FORMATOS);
  igual('las series de TV se numeran por año', [...t], [[113813, 1], [124410, 2], [154745, 3]]);
  check('un ONA no es una temporada', !t.has(179344));
  check('y una obra sin formato tampoco', !t.has(213581));

  // El orden de anilistIds viene del grafo, que no es cronológico.
  const desordenado = temporadasDe([154745, 113813, 124410], FORMATOS);
  igual('el orden del array no manda, manda el año',
    [...desordenado], [[113813, 1], [124410, 2], [154745, 3]]);
}

// -------------------------------------------------------------- filas pendientes
const FECHA = Math.floor(Date.UTC(2026, 8, 3, 12, 0, 0) / 1000); // 2026-09-03

{
  // Una sola temporada: no se numera.
  const ficha = { id: 5, title: 'Una sola temporada', anilistIds: [113813], entries: [] };
  const { filas } = filasPendientes(ficha, [{ mediaId: 113813, progress: 3, updatedAt: FECHA }], FORMATOS);
  igual('propone un episodio por cada uno visto', filas.map((f) => f.episode), [3, 2, 1]);
  igual('con una sola temporada no se numera', filas.map((f) => f.season), [null, null, null]);
  igual('la fecha sólo va en el último visto', filas.map((f) => f.date), ['2026-09-03', '', '']);
  check('el texto NO viene puesto', filas.every((f) => f.text === undefined));
  check('la nota tampoco', filas.every((f) => f.rating === undefined));
}

{
  // Lo ya escrito no se vuelve a proponer.
  const ficha = {
    id: 5, title: 'x', anilistIds: [113813],
    entries: [{ episode: 2, text: 'ya opinado' }, { episode: 5, text: 'de otro sitio' }],
  };
  const { filas } = filasPendientes(ficha, [{ mediaId: 113813, progress: 3, updatedAt: FECHA }], FORMATOS);
  igual('no repite lo que ya está escrito', filas.map((f) => f.episode), [3, 1]);
}

{
  // Varias temporadas: se numeran y se ordenan de lo más nuevo a lo más viejo.
  const ficha = { id: 6, title: 'Rent-a-Girlfriend', anilistIds: IDS, entries: [] };
  const { filas } = filasPendientes(ficha, [
    { mediaId: 113813, progress: 2, updatedAt: FECHA },
    { mediaId: 154745, progress: 1, updatedAt: FECHA },
  ], FORMATOS);
  igual('numera la temporada de cada obra',
    filas.map((f) => `T${f.season}E${f.episode}`), ['T3E1', 'T1E2', 'T1E1']);

  // Y una entrada escrita en la temporada 1 no tapa la misma numeración de la 3.
  const ficha2 = { ...ficha, entries: [{ season: 1, episode: 2, text: 'x' }] };
  const r2 = filasPendientes(ficha2, [
    { mediaId: 113813, progress: 2, updatedAt: FECHA },
    { mediaId: 154745, progress: 2, updatedAt: FECHA },
  ], FORMATOS);
  igual('la temporada forma parte de la identidad de la entrada',
    r2.filas.map((f) => `T${f.season}E${f.episode}`), ['T3E2', 'T3E1', 'T1E1']);
}

{
  // Nada visto, nada que proponer.
  const ficha = { id: 5, title: 'x', anilistIds: [113813], entries: [] };
  igual('sin progreso no hay filas',
    filasPendientes(ficha, [{ mediaId: 113813, progress: 0, updatedAt: FECHA }], FORMATOS).filas, []);
  igual('sin entrada en la lista tampoco',
    filasPendientes(ficha, [], FORMATOS).filas, []);
}

{
  // Un tope, para que 60 episodios sin comentar no sean 60 filas.
  const ficha = { id: 5, title: 'x', anilistIds: [113813], entries: [] };
  const r = filasPendientes(ficha, [{ mediaId: 113813, progress: 30, updatedAt: FECHA }],
    FORMATOS, { maxPorObra: 12 });
  igual('corta en el tope', r.filas.length, 12);
  igual('y dice cuántas se ha dejado', r.recortadas, 18);
  igual('conservando las más recientes', r.filas[0].episode, 30);
}

// ------------------------------------------------------------------- la bandeja
{
  const items = [
    { id: 5, title: 'Con ids', anilistIds: [113813], entries: [] },
    { id: 9, title: 'Sin ids', entries: [] },              // no se puede cruzar
    { id: 7, title: 'No la sigue', anilistIds: [124410], entries: [] },
  ];
  const listas = new Map([[113813, { mediaId: 113813, progress: 1, updatedAt: FECHA }]]);
  const bandeja = construirBandeja(items, listas, FORMATOS);
  igual('sólo salen las fichas que se pueden cruzar', bandeja.map((b) => b.ficha.id), [5]);
}

// Las 8 fichas reales ya declaran anilistIds, así que todas pueden entrar.
{
  const anime = JSON.parse(readFileSync(resolve(RAIZ, 'public/data/anime.json'), 'utf8'));
  const sinIds = anime.items.filter((i) => !(i.anilistIds ?? []).length);
  igual('las fichas reales pueden cruzarse con AniList', sinIds.map((i) => i.title), []);
}

// -------------------------------------------------------- interpretar y explicar
{
  const { listasPorId, formatos } = interpretar({
    data: {
      MediaListCollection: { lists: [
        { entries: [{ mediaId: 1, progress: 4, updatedAt: FECHA }] },
        { entries: [{ mediaId: 2, progress: 9, updatedAt: FECHA }] },
      ] },
      Page: { media: [{ id: 1, format: 'TV', seasonYear: 2020 }] },
    },
  });
  igual('junta las entradas de todas las listas', [...listasPorId.keys()], [1, 2]);
  igual('y los formatos', [...formatos], [[1, { format: 'TV', year: 2020 }]]);
  igual('una respuesta vacía no revienta', interpretar({}).listasPorId.size, 0);
}

{
  check('un usuario que no existe se explica',
    explicarError(404, [{ message: 'User not found' }]).includes('no encuentra ese usuario'));
  check('una lista privada se explica',
    explicarError(403, []).includes('privada'));
  check('y el límite de peticiones también',
    explicarError(429, []).includes('limitando'));
  check('lo demás dice el código',
    explicarError(500, [{ message: 'Internal Server Error' }]).includes('500'));
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones de la bandeja pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
