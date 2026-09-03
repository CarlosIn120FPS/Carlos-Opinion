#!/usr/bin/env node
/**
 * Comprueba el diario por niveles: node scripts/test-entries.mjs
 *
 * Dos cosas distintas:
 *
 *  1. Que las fichas reales sobreviven intactas. `entries` es aditivo, así que
 *     esto debería pasar solo — precisamente por eso hay que ejecutarlo: si algún
 *     día deja de pasar, es que alguien tocó los datos de Carlos sin querer.
 *  2. Que el agrupado y el orden hacen lo que dice docs/esquema-ficha.md, con
 *     fichas sintéticas. En public/data/ no se escribe texto de ejemplo: esos
 *     campos son su voz.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeContent } from '../src/data/normalize.js';
import { buildDiary, normalizeEntries } from '../src/lib/entries.js';
import { ESQUEMA } from '../src/data/niveles.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let pasan = 0;
const fallos = [];

const check = (nombre, condicion, detalle = '') => {
  if (condicion) pasan += 1;
  else fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const igual = (nombre, real, esperado) =>
  check(
    nombre,
    JSON.stringify(real) === JSON.stringify(esperado),
    `esperaba ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`,
  );

// ------------------------------------------------ 1. las fichas reales, intactas
const FICHEROS = [
  ['anime.json', 'anime'],
  ['manga.json', 'manga'],
  ['lightnovels.json', 'lightnovel'],
];

let fichasRevisadas = 0;

for (const [fichero, tipo] of FICHEROS) {
  const crudo = JSON.parse(readFileSync(resolve(RAIZ, 'public/data', fichero), 'utf8'));
  const salida = normalizeContent(crudo);

  igual(`${fichero}: mismo número de fichas`, salida.items.length, crudo.items.length);
  igual(`${fichero}: categorías intactas`, salida.categories, crudo.categories);

  crudo.items.forEach((original, i) => {
    fichasRevisadas += 1;
    const normalizada = salida.items[i];

    // Todo campo que ya existía tiene que salir idéntico. Esta es la prueba de
    // que el esquema nuevo no degrada nada de lo que escribió a mano.
    for (const clave of Object.keys(original)) {
      igual(
        `${fichero}[${i}] "${original.title}": ${clave} sin tocar`,
        normalizada[clave],
        original[clave],
      );
    }

    // El normalizador rellena con [] las listas que una ficha no traiga: eso ya
    // lo hacía antes y es lo que evita que un modal tenga que defenderse. Lo que
    // se comprueba aquí es que no aparezca ningún campo fuera de esa lista.
    const GARANTIZADOS = [
      'genres', 'platforms', 'languages', 'openings', 'endings',
      'physicalStores', 'entries', 'related',
    ];
    const nuevas = Object.keys(normalizada).filter((k) => !(k in original));
    igual(
      `${fichero}[${i}]: no inventa campos`,
      nuevas.filter((k) => !GARANTIZADOS.includes(k)),
      [],
    );
    check(`${fichero}[${i}]: añade el diario`, nuevas.includes('entries'));
    igual(`${fichero}[${i}]: diario vacío`, normalizada.entries, []);

    // Una ficha sin diario no pinta ni la cabecera.
    igual(
      `${fichero}[${i}]: sin diario no hay bloque`,
      buildDiary(normalizada.entries, ESQUEMA[tipo].levels).total,
      0,
    );

    // Una portada propia ("covers/anime-8.jpg") tiene que existir en public/:
    // si el fichero falta, la web enseña el recuadro gris sin que nadie avise.
    const portada = normalizada.image;
    if (portada && !/^(https?:)?\/\//.test(portada) && !portada.startsWith('data:')) {
      check(
        `${fichero}[${i}] "${original.title}": la portada local existe`,
        existsSync(resolve(RAIZ, 'public', portada)),
        `no hay public/${portada}`,
      );
    }
  });
}

// ------------------------------------- 2. control positivo: ¿detecta un cambio?
// Sin esto, todo lo de arriba podría estar pasando por no comprobar nada.
{
  const roto = normalizeContent({ items: [{ title: 'X', genres: 'no es un array' }] });
  check(
    'control positivo: normaliza un campo mal escrito',
    Array.isArray(roto.items[0].genres) && roto.items[0].genres.length === 0,
    'genres debería haberse convertido en []',
  );
  check(
    'control positivo: la comparación sabe fallar',
    JSON.stringify({ a: 1 }) !== JSON.stringify({ a: 2 }),
  );
}

// ------------------------------------------------------- 3. el diario, de verdad
const anime = ESQUEMA.anime.levels;
const manga = ESQUEMA.manga.levels;
const novela = ESQUEMA.lightnovel.levels;

// Descarta lo que no dice nada.
{
  const limpio = normalizeEntries([
    { text: 'algo' },
    { rating: 7 },
    { text: '   ' },
    { season: 1 },
    null,
    'no soy un objeto',
    [],
  ]);
  igual('descarta entradas sin texto ni nota', limpio.length, 2);
}

// Una temporada: ni cabecera, ni "En conjunto"; episodios ordenados.
{
  const d = buildDiary(
    [
      { episode: 3, text: 'c' },
      { episode: 1, text: 'a' },
      { episode: 2, text: 'b' },
    ],
    anime,
  );
  check('una sola temporada: no agrupa', d.grouped === false);
  igual('una sola temporada: un grupo', d.groups.length, 1);
  igual(
    'una sola temporada: ordena por episodio',
    d.groups[0].items.map((i) => i.label),
    ['Episodio 1', 'Episodio 2', 'Episodio 3'],
  );
}

// Varias temporadas: agrupa, y la del conjunto va antes que sus episodios.
{
  const d = buildDiary(
    [
      { season: 2, episode: 1, text: 'b' },
      { season: 1, episode: 5, text: 'a' },
      { season: 2, rating: 8, text: 'la temporada entera' },
      { text: 'nota suelta' },
    ],
    anime,
  );
  check('varias temporadas: agrupa', d.grouped === true);
  igual(
    'varias temporadas: orden de grupos, generales al final',
    d.groups.map((g) => g.label),
    ['Temporada 1', 'Temporada 2', 'Notas generales'],
  );
  igual(
    'varias temporadas: el conjunto antes que los episodios',
    d.groups[1].items.map((i) => i.label),
    ['En conjunto', 'Episodio 1'],
  );
  igual('la nota suelta no lleva etiqueta', d.groups[2].items[0].label, '');
  igual('cuenta todas las entradas', d.total, 4);
}

// Sin agrupar, una entrada de temporada dice de cuál habla.
{
  const d = buildDiary([{ season: 2, text: 'a' }], anime);
  check('un solo grupo: no agrupa', d.grouped === false);
  igual('sin cabecera, la etiqueta lleva la temporada', d.groups[0].items[0].label, 'Temporada 2');
}

// Manga y novelas: las mismas reglas con otros nombres.
{
  const d = buildDiary([{ volume: 1, chapter: 4, text: 'a' }], manga);
  igual('manga usa volumen y capítulo', d.groups[0].items[0].label, 'Capítulo 4');

  const n = buildDiary([{ volume: 2, text: 'a' }, { volume: 1, text: 'b' }], novela);
  igual(
    'novelas sólo tienen volumen',
    n.groups.map((g) => g.label),
    ['Volumen 1', 'Volumen 2'],
  );
  // Novelas no declara un segundo nivel: un "chapter" suelto no debe inventarlo.
  const raro = buildDiary([{ volume: 1, chapter: 9, text: 'a' }], novela);
  igual('novelas ignoran un capítulo que no declaran', raro.groups[0].items[0].label, 'Volumen 1');
}

// Orden estable: dos entradas idénticas no bailan entre ejecuciones.
{
  const mismas = [
    { season: 1, episode: 1, text: 'primera' },
    { season: 1, episode: 1, text: 'segunda' },
  ];
  igual(
    'orden estable a igualdad de nivel',
    buildDiary(mismas, anime).groups[0].items.map((i) => i.entry.text),
    ['primera', 'segunda'],
  );
}

// La fecha desempata cuando el nivel no lo hace.
{
  const d = buildDiary(
    [
      { text: 'после', date: '2026-02-01' },
      { text: 'antes', date: '2026-01-01' },
    ],
    anime,
  );
  igual(
    'la fecha desempata',
    d.groups[0].items.map((i) => i.entry.text),
    ['antes', 'после'],
  );
}

// Notas escritas como cadena ("9") siguen siendo notas.
{
  const d = buildDiary([{ episode: 1, rating: '9', text: 'a' }], anime);
  igual('acepta la nota escrita como cadena', d.groups[0].items[0].entry.rating, '9');
  igual('y la ordena como número', buildDiary([{ episode: '2', text: 'b' }, { episode: 1, text: 'a' }], anime)
    .groups[0].items.map((i) => i.entry.text), ['a', 'b']);
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${fichasRevisadas} fichas reales revisadas`);
console.log(`  ${pasan} comprobaciones pasan, ${fallos.length} fallan\n`);

if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
