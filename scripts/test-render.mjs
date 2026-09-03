#!/usr/bin/env node
/**
 * Renderiza EntriesBlock de verdad y mira el HTML: node scripts/test-render.mjs
 *
 * scripts/test-entries.mjs prueba la lógica pura; esto prueba que el componente
 * la pinta. Que `vite build` pase sólo dice que el JSX es sintácticamente válido,
 * no que el bloque salga.
 *
 * Se apoya en esbuild (ya viene con vite) para compilar el .jsx al vuelo, así que
 * no añade ninguna dependencia al proyecto.
 */

import { mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Los modales miran window al montarse. En SSR los efectos no corren, pero el
// inicializador de useState de LightNovelModal sí: sin esto revienta al importar.
globalThis.window ??= { innerWidth: 1280, addEventListener() {}, removeEventListener() {} };

// Compilamos los componentes a ficheros sueltos que node sí puede importar.
// Tienen que quedar DENTRO del proyecto: desde %TEMP% no resuelve `react`.
const cache = resolve(RAIZ, 'node_modules/.cache/co-render');
mkdirSync(cache, { recursive: true });

const compilar = async (fichero, nombre) => {
  const salida = join(cache, nombre);
  await build({
    entryPoints: [resolve(RAIZ, fichero)],
    outfile: salida,
    bundle: true,
    format: 'esm',
    platform: 'node',
    // El proyecto usa el runtime automático de JSX (lo pone @vitejs/plugin-react);
    // esbuild por defecto usa el clásico, que espera un `React` en el ámbito.
    jsx: 'automatic',
    // CoverImage lee BASE_URL para las rutas relativas. Fuera de vite no existe.
    define: { 'import.meta.env.BASE_URL': '"/"' },
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    logLevel: 'silent',
  });
  return (await import(pathToFileURL(salida).href)).default;
};

const EntriesBlock = await compilar('src/components/EntriesBlock.jsx', 'bloque.mjs');
const { ESQUEMA } = await import(pathToFileURL(resolve(RAIZ, 'src/data/niveles.js')).href);

let pasan = 0;
const fallos = [];
const check = (nombre, condicion, detalle = '') => {
  if (condicion) pasan += 1;
  else fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const pintar = (props) => renderToStaticMarkup(createElement(EntriesBlock, props));

// El HTML escapa comillas y acentos; comparar sobre el crudo da falsos negativos.
// (Ya pasó con el test del router: seis fallos que eran &#x27; en vez de '.)
const texto = (html) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// ------------------------------------------------------- ficha sin diario: nada
{
  const html = pintar({ entries: [], schema: ESQUEMA.anime });
  check('sin entradas no pinta nada', html === '', `pintó ${JSON.stringify(html)}`);

  const sinCampo = pintar({ entries: undefined, schema: ESQUEMA.anime });
  check('sin el campo tampoco revienta', sinCampo === '');
}

// ------------------------------------------------- anime plegado: sólo el botón
{
  const entradas = [
    { episode: 1, rating: 8, text: 'ARRANQUE', date: '2026-09-01' },
    { episode: 2, text: 'SEGUNDO' },
  ];
  const html = pintar({ entries: entradas, schema: ESQUEMA.anime });
  const plano = texto(html);

  check('plegado: enseña el título del diario', plano.includes('Diario de visionado'), plano);
  check('plegado: invita con el contador', plano.includes('Ver 2 notas'), plano);
  check('plegado: NO enseña el texto todavía', !plano.includes('ARRANQUE'), plano);
  check('plegado: aria-expanded en falso', html.includes('aria-expanded="false"'));
}

// --------------------------------------- control positivo: ¿detectaría un fallo?
// Si el bloque dejase de pintar contenido, los checks de abajo tienen que caerse.
{
  const html = pintar({
    entries: [{ episode: 1, rating: 8, text: 'ARRANQUE' }],
    schema: ESQUEMA.anime,
    collapsible: false,
  });
  check('control positivo: hay HTML de verdad', html.length > 200, `sólo ${html.length} caracteres`);
}

// ------------------------------------------- anime desplegado: todo el contenido
{
  const entradas = [
    { season: 2, episode: 1, text: 'SEGUNDA T PRIMER EP' },
    { season: 1, episode: 5, text: 'PRIMERA T' },
    { season: 2, rating: 8.5, text: 'LA TEMPORADA ENTERA' },
    { text: 'NOTA SUELTA' },
  ];
  const plano = texto(pintar({ entries: entradas, schema: ESQUEMA.anime, collapsible: false }));

  check('desplegado: cabecera de temporada 1', plano.includes('Temporada 1'), plano);
  check('desplegado: cabecera de temporada 2', plano.includes('Temporada 2'), plano);
  check('desplegado: grupo de notas generales', plano.includes('Notas generales'), plano);
  check('desplegado: etiqueta del conjunto', plano.includes('En conjunto'), plano);
  check('desplegado: la nota sale con /10', plano.includes('8.5/10'), plano);
  check('desplegado: sale el texto', plano.includes('LA TEMPORADA ENTERA'), plano);

  // Y en el orden que manda el esquema: T1, luego T2 (conjunto antes que su ep),
  // luego las generales.
  const orden = ['PRIMERA T', 'LA TEMPORADA ENTERA', 'SEGUNDA T PRIMER EP', 'NOTA SUELTA'];
  const posiciones = orden.map((t) => plano.indexOf(t));
  check(
    'desplegado: respeta el orden del esquema',
    posiciones.every((p, i) => p >= 0 && (i === 0 || p > posiciones[i - 1])),
    `posiciones ${JSON.stringify(posiciones)}`,
  );
}

// ------------------------------------------------- las tres pieles, y la del libro
{
  const entradas = [{ volume: 1, text: 'VOLUMEN UNO' }];

  const vinieta = pintar({ entries: entradas, schema: ESQUEMA.manga, variant: 'vinieta', collapsible: false });
  check('viñeta: usa la sombra dura del cómic', vinieta.includes('shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'));
  check('viñeta: dice diario de lectura', texto(vinieta).includes('Diario de lectura'));

  const libro = pintar({ entries: entradas, schema: ESQUEMA.lightnovel, variant: 'libro', collapsible: false });
  check('libro: no mete un botón que rompería la paginación', !libro.includes('<button'));
  check('libro: evita partir una entrada entre columnas', libro.includes('break-inside-avoid'));
  check('libro: enseña el contador en vez del botón', texto(libro).includes('1 nota'), texto(libro));

  // Singular y plural, que es de lo que más canta.
  const dos = pintar({ entries: [{ volume: 1, text: 'a' }, { volume: 2, text: 'b' }], schema: ESQUEMA.lightnovel, variant: 'libro', collapsible: false });
  check('libro: concuerda el plural', texto(dos).includes('2 notas'), texto(dos));
}

// ------------------------------- los tres modales de verdad, con el bloque dentro
// Aquí es donde se rompen las cosas: un prop mal escrito compila igual de bien.
{
  const comun = {
    id: 1,
    title: 'FICHA DE PRUEBA',
    japaneseTitle: '—',
    image: 'https://example.invalid/portada.jpg',
    description: '—',
    fullSynopsis: '—',
    genres: ['Prueba'],
    platforms: [],
    languages: [],
    openings: [],
    endings: [],
    physicalStores: [],
    rating: '',
    ratingFinal: '',
    personalOpinion: '',
    personalOpinionFinal: '',
    doIRecommend: '',
  };

  const modales = [
    ['AnimeModal', 'anime', [{ season: 1, episode: 4, rating: 9, text: 'DEL DIARIO' }]],
    ['MangaModal', 'manga', [{ volume: 2, text: 'DEL DIARIO' }]],
    ['LightNovelModal', 'lightnovel', [{ volume: 3, text: 'DEL DIARIO' }]],
  ];

  for (const [nombre, tipo, entries] of modales) {
    const Modal = await compilar(`src/components/${nombre}.jsx`, `${nombre}.mjs`);
    const item = { ...comun, entries };

    let html = '';
    let error = null;
    try {
      html = renderToStaticMarkup(createElement(Modal, { item, onClose() {} }));
    } catch (e) {
      error = e;
    }

    check(`${nombre}: monta sin reventar`, error === null, error?.message);
    if (error) continue;

    const plano = texto(html);
    check(`${nombre}: enseña el diario`, plano.includes(ESQUEMA[tipo].diaryTitle), plano.slice(0, 200));
    // Anime y manga van plegados; el libro, desplegado.
    const plegado = tipo !== 'lightnovel';
    check(
      `${nombre}: ${plegado ? 'plegado' : 'desplegado'} como toca`,
      plano.includes('DEL DIARIO') === !plegado,
      plano.slice(0, 300),
    );
    // Y sigue pintando la ficha de siempre.
    check(`${nombre}: la ficha sigue ahí`, plano.includes('FICHA DE PRUEBA'));
  }

  // Sin diario, ninguno de los tres debe enseñar la cabecera.
  for (const [nombre, tipo] of modales) {
    const Modal = await compilar(`src/components/${nombre}.jsx`, `${nombre}.mjs`);
    const plano = texto(
      renderToStaticMarkup(createElement(Modal, { item: { ...comun, entries: [] }, onClose() {} })),
    );
    check(`${nombre}: sin diario no enseña la cabecera`, !plano.includes(ESQUEMA[tipo].diaryTitle));
    check(`${nombre}: pero la ficha se pinta igual`, plano.includes('FICHA DE PRUEBA'));
  }
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones de render pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
