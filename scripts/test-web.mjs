#!/usr/bin/env node
/**
 * Comprueba el buscador y las notas: node scripts/test-web.mjs
 *
 * Todo contra las fichas reales, porque el valor de estas dos piezas se mide en
 * sus datos: buscar "Yofukashi" tiene que encontrar Call of the Night, y ordenar
 * por nota tiene que poner los dieces delante.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesSearch, searchableText } from '../src/lib/search.js';
import { parseRating, itemRating, showRating, isUnrated } from '../src/lib/rating.js';
import { normalizeContent } from '../src/data/normalize.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cargar = (f) =>
  normalizeContent(JSON.parse(readFileSync(resolve(RAIZ, 'public/data', f), 'utf8'))).items;

const anime = cargar('anime.json');
const manga = cargar('manga.json');

let pasan = 0;
const fallos = [];
const check = (nombre, cond, detalle = '') => {
  if (cond) pasan += 1;
  else fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
};
const igual = (nombre, real, esperado) =>
  check(nombre, JSON.stringify(real) === JSON.stringify(esperado),
    `esperaba ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`);

const buscar = (lista, termino) => lista.filter((i) => matchesSearch(i, termino)).map((i) => i.title);

// ------------------------------------------------------------------- las notas
igual('parseRating: "8.5/10"', parseRating('8.5/10'), 8.5);
igual('parseRating: "9/10"', parseRating('9/10'), 9);
igual('parseRating: "10/10" no se lee como 1', parseRating('10/10'), 10);
igual('parseRating: coma decimal', parseRating('9,5/10'), 9.5);
igual('parseRating: número pelado', parseRating(7), 7);
igual('parseRating: vacío', parseRating(''), null);
igual('parseRating: no es nota', parseRating('pendiente'), null);
igual('parseRating: null', parseRating(null), null);
igual('showRating: sin ceros de relleno', showRating(9), '9');
igual('showRating: decimal', showRating(8.5), '8.5');

// La final manda sobre la de "mientras lo veía": es el veredicto al terminar.
igual('itemRating: gana la final', itemRating({ rating: '8.5/10', ratingFinal: '10/10' }), 10);
igual('itemRating: sin final, vale la otra', itemRating({ rating: '7/10' }), 7);
igual('itemRating: sin ninguna', itemRating({ rating: '', ratingFinal: '' }), null);

// Sus 7 pares suben al terminar. Si algún día uno bajase, no es un fallo: es que
// cambió de opinión. Lo que se comprueba es que las dos se leen.
{
  const pares = anime.filter((i) => parseRating(i.rating) !== null && parseRating(i.ratingFinal) !== null);
  check('hay pares de notas que leer', pares.length >= 5, `sólo ${pares.length}`);
  check(
    'las dos notas de cada par se leen como número',
    pares.every((i) => typeof parseRating(i.rating) === 'number'),
  );
}

// ---------------------------------------------------------------- "sin opinar"
{
  const sinOpinar = anime.filter(isUnrated).map((i) => i.title);
  // Alya y Rent-a-Girlfriend tienen los seis campos vacíos.
  check('Alya sale como sin opinar',
    sinOpinar.some((t) => t.startsWith('Alya')), JSON.stringify(sinOpinar));
  check('Rent-a-Girlfriend sale como sin opinar',
    sinOpinar.includes('Rent-a-Girlfriend'), JSON.stringify(sinOpinar));
  // High School DxD no tiene opinión escrita pero sí un 10/10: eso es opinar.
  check('una ficha con nota NO sale como sin opinar',
    !sinOpinar.includes('High School DxD'), JSON.stringify(sinOpinar));
  // Y una entrada del diario basta para no estar "sin opinar".
  check('una entrada del diario ya cuenta como opinión',
    !isUnrated({ rating: '', entries: [{ episode: 1, text: 'algo' }] }));
  check('control: sin nada, sin opinar', isUnrated({ rating: '', ratingFinal: '' }));
}

// ------------------------------------------------------------------ el buscador
// El caso que motivó todo esto: el título japonés.
igual('busca por título japonés: "Yofukashi"', buscar(anime, 'Yofukashi'), ['Call of the Night']);
igual('busca en japonés de verdad: "青ブタ"',
  buscar(anime, '青ブタ'), ['Rascal Does Not Dream of... (muchas variantes)']);
igual('busca por romanización: "Seishun Buta"',
  buscar(anime, 'Seishun Buta'), ['Rascal Does Not Dream of... (muchas variantes)']);

// Antes esto era lo ÚNICO que funcionaba, así que tiene que seguir funcionando.
igual('sigue buscando por título', buscar(anime, 'Rent-a'), ['Rent-a-Girlfriend']);

// El título de la edición española: «Un amor de tinta y espuma» no se parece en
// nada a «The Summer You Were There», y es como él lo conoce. Ficha sintética.
{
  const conEs = [
    ...manga,
    { id: 999, title: 'The Summer You Were There', spanishTitle: 'Un amor de tinta y espuma', genres: [] },
  ];
  igual('busca por título en español', buscar(conEs, 'tinta y espuma'), ['The Summer You Were There']);
  igual('y sin tildes', buscar(conEs, 'espuma'), ['The Summer You Were There']);
  check('searchableText incluye el título español',
    searchableText(conEs.at(-1)).includes('un amor de tinta y espuma'));
}

// Sin tildes.
check('"japones" encuentra "Japonés"', buscar(anime, 'japones').length > 0);
check('"comedia" encuentra el género', buscar(anime, 'comedia').length >= 4,
  JSON.stringify(buscar(anime, 'comedia')));

// Varias palabras, aunque estén en campos distintos.
{
  const r = buscar(anime, 'romance escolar');
  check('varias palabras, campos distintos', r.length > 0, JSON.stringify(r));
  const nada = buscar(anime, 'romance dinosaurios');
  igual('una palabra que no está descarta la ficha', nada, []);
}

// Manga: autor.
igual('busca por autor', buscar(manga, 'Fujimoto'), ['Chainsaw Man']);

// Búsqueda vacía = todo. Y no se cuela la sinopsis entera.
igual('búsqueda vacía devuelve todo', buscar(anime, '').length, anime.length);
igual('espacios sueltos también', buscar(anime, '   ').length, anime.length);
{
  const conSinopsis = anime.filter((i) => searchableText(i).includes('kujou'));
  igual('la sinopsis larga NO entra en el buscador', conSinopsis.length, 0);
}

// ------------------------------------------ control positivo: ¿sabe fallar esto?
check('control positivo: un término inventado no encuentra nada',
  buscar(anime, 'zzzzqqq').length === 0);
check('control positivo: hay fichas que buscar', anime.length >= 8);

// ------------------------------------------------------------- ordenar por nota
{
  const compare = (a, b) => {
    const ra = itemRating(a);
    const rb = itemRating(b);
    if (ra === null && rb === null) return a.id - b.id;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return rb - ra || a.id - b.id;
  };
  const ordenado = [...anime].sort(compare);
  const notas = ordenado.map(itemRating);

  const conNota = notas.filter((n) => n !== null);
  igual('ordena de mayor a menor',
    conNota, [...conNota].sort((a, b) => b - a));
  // Lo importante: las que no tienen nota van al final, no delante con un 0.
  const primeraSinNota = notas.indexOf(null);
  check('las fichas sin nota van al final',
    primeraSinNota === -1 || notas.slice(primeraSinNota).every((n) => n === null),
    JSON.stringify(notas));
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones de la web pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
