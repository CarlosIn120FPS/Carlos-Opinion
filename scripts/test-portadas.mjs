#!/usr/bin/env node
/**
 * Comprueba las portadas locales: node scripts/test-portadas.mjs
 *
 * Sin red: `descargar` y `escribir` son mocks. Lo que se prueba es el criterio:
 * qué se baja, qué se acepta como imagen, qué se reintenta y qué no, y que la
 * ficha nunca se queda sin `image`. Al final, con datos sintéticos y un
 * directorio temporal, el flujo entero de scripts/portadas.mjs.
 */

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import {
  tipoDeImagen, esExterna, esLocal, pendientesDe, aplicarPortada, localizar,
  FalloPermanente, INTENTOS_MAX, TAMANO_MAX,
} from '../panel/lib/portadas.mjs';
import { localizarRepo } from './portadas.mjs';
import { SECCIONES } from '../panel/lib/secciones.mjs';

let pasan = 0;
const fallos = [];
const check = (n, cond, d = '') => { if (cond) pasan += 1; else fallos.push(`${n}${d ? ` — ${d}` : ''}`); };
const igual = (n, real, esp) =>
  check(n, JSON.stringify(real) === JSON.stringify(esp),
    `esperaba ${JSON.stringify(esp)}, obtuve ${JSON.stringify(real)}`);

// Imágenes mínimas: sólo importan los bytes mágicos.
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const HTML = new TextEncoder().encode('<!doctype html><html><body>404</body></html>');

// ------------------------------------------------------------- tipo por bytes
igual('jpg por bytes mágicos', tipoDeImagen(JPG), 'jpg');
igual('png por bytes mágicos', tipoDeImagen(PNG), 'png');
igual('webp por bytes mágicos', tipoDeImagen(WEBP), 'webp');
igual('html no es imagen', tipoDeImagen(HTML), null);
igual('vacío no es imagen', tipoDeImagen(new Uint8Array()), null);

check('esExterna: http', esExterna('http://x/a.jpg') && esExterna('https://x/a.jpg'));
check('esExterna: no para rutas propias ni vacías', !esExterna('covers/anime-8.jpg') && !esExterna(''));
check('esLocal', esLocal('covers/anime-8.jpg') && !esLocal('https://x/a.jpg'));

// ---------------------------------------------------------- qué toca bajar
const datosAnime = { categories: ['Visto'], items: [
  { id: 1, title: 'A', category: 'Visto', image: 'https://cdn.x/a.jpg', rating: '9/10' },
  { id: 2, title: 'B', category: 'Visto', image: 'covers/anime-2.jpg' },
  { id: 3, title: 'C', category: 'Visto', image: '' },
  { id: 4, title: 'D', category: 'Visto', image: 'https://cdn.x/muerta.jpg' },
] };

igual('pendientes: sólo las externas', pendientesDe(datosAnime, 'anime').map((p) => p.id), [1, 4]);
igual('pendientes: una URL que ya falló 3 veces no se vuelve a pedir',
  pendientesDe(datosAnime, 'anime', { 'anime-4': { url: 'https://cdn.x/muerta.jpg', fallo: 'HTTP 404', intentos: INTENTOS_MAX } })
    .map((p) => p.id), [1]);
igual('pendientes: pero si la URL cambió, sí',
  pendientesDe(datosAnime, 'anime', { 'anime-4': { url: 'https://cdn.x/otra.jpg', fallo: 'HTTP 404', intentos: 9 } })
    .map((p) => p.id), [1, 4]);

// ----------------------------------------------------------- aplicar portada
{
  const nuevos = aplicarPortada(datosAnime, 'anime', 1, 'covers/anime-1.jpg');
  igual('aplicarPortada cambia image', nuevos.items[0].image, 'covers/anime-1.jpg');
  igual('y no muta la entrada', datosAnime.items[0].image, 'https://cdn.x/a.jpg');
  igual('y respeta el orden de claves', Object.keys(nuevos.items[0]), ['id', 'title', 'category', 'image', 'rating']);
  check('ficha inexistente revienta', (() => { try { aplicarPortada(datosAnime, 'anime', 99, 'x'); return false; } catch { return true; } })());
}

// ------------------------------------------------------- el flujo, con mocks
{
  const bajadas = [];
  const escritos = {};
  const descargar = async (url) => {
    bajadas.push(url);
    if (url.endsWith('muerta.jpg')) throw new FalloPermanente('HTTP 404');
    if (url.endsWith('caida.jpg')) throw new Error('fetch failed: ECONNRESET');
    if (url.endsWith('pagina.jpg')) return HTML;
    if (url.endsWith('gorda.jpg')) return new Uint8Array(TAMANO_MAX + 1);
    if (url.endsWith('.png')) return PNG;
    return JPG;
  };
  const escribir = async (nombre, bytes) => { escritos[nombre] = bytes.length; };

  const manga = { categories: ['Leído'], items: [
    { id: 1, title: 'M1', category: 'Leído', image: 'https://cdn.x/m1.png' },
    { id: 2, title: 'M2', category: 'Leído', image: 'https://cdn.x/caida.jpg' },
    { id: 3, title: 'M3', category: 'Leído', image: 'https://cdn.x/pagina.jpg' },
    { id: 4, title: 'M4', category: 'Leído', image: 'https://cdn.x/gorda.jpg' },
  ] };

  const r = await localizar({
    datosPorClave: { anime: datosAnime, manga }, origen: {}, descargar, escribir, hoy: '2026-09-03',
  });

  igual('baja las externas de las dos secciones', bajadas.length, 6);
  igual('escribe con la extensión REAL, no la de la URL', Object.keys(escritos).sort(),
    ['anime-1.jpg', 'manga-1.png']);
  igual('la ficha apunta al fichero propio', r.datosPorClave.anime.items[0].image, 'covers/anime-1.jpg');
  igual('la que ya era local no se toca', r.datosPorClave.anime.items[1].image, 'covers/anime-2.jpg');
  igual('la muerta (404) CONSERVA su URL: nunca se deja en blanco',
    r.datosPorClave.anime.items[3].image, 'https://cdn.x/muerta.jpg');
  igual('y queda anotada como fallo permanente, sin más reintentos',
    r.origen['anime-4'], { url: 'https://cdn.x/muerta.jpg', fallo: 'HTTP 404', fecha: '2026-09-03', intentos: INTENTOS_MAX });
  igual('un fallo de red se reintentará: cuenta 1 intento',
    r.origen['manga-2'].intentos, 1);
  igual('y se informa como reintentar',
    r.informe.find((f) => f.clave === 'manga' && f.id === 2).estado, 'reintentar');
  igual('una página HTML no es una portada: fallo permanente',
    r.informe.find((f) => f.clave === 'manga' && f.id === 3).estado, 'fallo');
  igual('una imagen demasiado grande: fallo permanente',
    r.informe.find((f) => f.clave === 'manga' && f.id === 4).estado, 'fallo');
  check('las que fallan siguen con su URL',
    r.datosPorClave.manga.items.slice(1).every((it) => it.image.startsWith('https://')));
  igual('el origen guarda la URL de la que salió cada fichero',
    r.origen['anime-1'], { url: 'https://cdn.x/a.jpg', fichero: 'anime-1.jpg', fecha: '2026-09-03', bytes: JPG.length });
  check('no muta los datos de entrada', datosAnime.items[0].image === 'https://cdn.x/a.jpg' && manga.items[0].image === 'https://cdn.x/m1.png');

  // Segunda pasada con el origen de la primera: la muerta no se vuelve a pedir,
  // la de red sí.
  const bajadas2 = [];
  const r2 = await localizar({
    datosPorClave: { anime: r.datosPorClave.anime, manga: r.datosPorClave.manga }, origen: r.origen,
    descargar: async (u) => { bajadas2.push(u); return descargar(u); }, escribir, hoy: '2026-09-04',
  });
  check('segunda pasada: no vuelve a pedir la muerta', !bajadas2.some((u) => u.endsWith('muerta.jpg')), JSON.stringify(bajadas2));
  check('pero sí la que falló por red', bajadas2.some((u) => u.endsWith('caida.jpg')));
  igual('y el contador de intentos sube', r2.origen['manga-2'].intentos, 2);
  igual('una sección sin cambios no aparece en la salida', Object.keys(r2.datosPorClave), []);

  // La alternativa (AniList) SÓLO cuando la original ha muerto de verdad.
  const consultas = [];
  const alternativa = async ({ clave, id, anilistIds }) => {
    consultas.push(`${clave}-${id}`);
    return anilistIds?.length ? `https://s4.anilist.co/${anilistIds[0]}.png` : null;
  };
  const novela = { categories: ['Leída'], items: [
    { id: 1, title: 'N1', category: 'Leída', image: 'https://cdn.x/muerta.jpg', anilistIds: [85470] },
    { id: 2, title: 'N2', category: 'Leída', image: 'https://cdn.x/muerta.jpg' },
    { id: 3, title: 'N3', category: 'Leída', image: 'https://cdn.x/caida.jpg', anilistIds: [1] },
    { id: 4, title: 'N4', category: 'Leída', image: 'https://cdn.x/viva.jpg', anilistIds: [2] },
  ] };
  const r3 = await localizar({
    datosPorClave: { lightnovel: novela }, origen: {}, descargar, escribir, alternativa, hoy: '2026-09-03',
  });
  igual('muerta + anilistIds: se baja la de AniList', r3.datosPorClave.lightnovel.items[0].image, 'covers/lightnovel-1.png');
  igual('y el origen dice de dónde salió y a cuál sustituye',
    [r3.origen['lightnovel-1'].url, r3.origen['lightnovel-1'].sustituye],
    ['https://s4.anilist.co/85470.png', 'https://cdn.x/muerta.jpg']);
  igual('muerta sin anilistIds: se queda con su URL', r3.datosPorClave.lightnovel.items[1].image, 'https://cdn.x/muerta.jpg');
  igual('un fallo de RED no pregunta a AniList (se reintenta la original)',
    r3.datosPorClave.lightnovel.items[2].image, 'https://cdn.x/caida.jpg');
  igual('una portada viva no se cambia por la de AniList', r3.origen['lightnovel-4'].url, 'https://cdn.x/viva.jpg');
  igual('sólo se consultó AniList para las muertas',
    consultas, ['lightnovel-1', 'lightnovel-2']);
}

// -------------------------------- el script entero, sobre un repo temporal
{
  const raiz = mkdtempSync(join(tmpdir(), 'co-portadas-'));
  mkdirSync(resolve(raiz, 'public/data'), { recursive: true });
  const escribirJson = (clave, datos) =>
    writeFileSync(resolve(raiz, SECCIONES[clave].fichero), `${JSON.stringify(datos, null, 2)}\n`);
  escribirJson('anime', { categories: ['Visto'], items: [
    { id: 8, title: 'Alya', category: 'Visto', image: 'https://cdn.x/alya.jpg' },
  ] });
  escribirJson('manga', { categories: [], items: [] });
  escribirJson('lightnovel', { categories: [], items: [] });

  // fetch simulado: JPG para todo.
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true, status: 200, headers: new Map([['content-length', String(JPG.length)]]),
    arrayBuffer: async () => JPG.buffer.slice(JPG.byteOffset, JPG.byteOffset + JPG.byteLength),
  });
  try {
    const seco = await localizarRepo(raiz, { seco: true, hoy: '2026-09-03' });
    igual('--seco no escribe nada', seco.cambiados, []);
    check('--seco tampoco crea el fichero', !existsSync(resolve(raiz, 'public/covers/anime-8.jpg')));

    const real = await localizarRepo(raiz, { hoy: '2026-09-03' });
    igual('escribe imagen, JSON y origen', real.cambiados,
      ['public/covers/anime-8.jpg', 'public/data/anime.json', 'public/covers/origen.json']);
    const json = JSON.parse(readFileSync(resolve(raiz, 'public/data/anime.json'), 'utf8'));
    igual('el JSON de la sección apunta al fichero', json.items[0].image, 'covers/anime-8.jpg');
    check('el fichero existe y son los bytes bajados',
      readFileSync(resolve(raiz, 'public/covers/anime-8.jpg')).length === JPG.length);
    const origen = JSON.parse(readFileSync(resolve(raiz, 'public/covers/origen.json'), 'utf8'));
    igual('origen.json recuerda la URL', origen['anime-8'].url, 'https://cdn.x/alya.jpg');

    const otra = await localizarRepo(raiz, { hoy: '2026-09-04' });
    igual('una segunda pasada no tiene nada que hacer', otra.cambiados, []);
  } finally {
    globalThis.fetch = fetchReal;
    rmSync(raiz, { recursive: true, force: true });
  }
}

console.log(`\n  ${pasan} comprobaciones de portadas pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
