#!/usr/bin/env node
/**
 * Comprueba el núcleo del panel: node scripts/test-panel.mjs
 *
 * El panel escribe en los datos de Carlos, que son lo único irreemplazable del
 * proyecto. Así que la prueba que manda es la primera: leer sus tres JSON,
 * parsearlos y volver a serializarlos tiene que dar EXACTAMENTE los mismos bytes.
 * Si eso falla, el panel reordena o pierde algo, y no se puede usar.
 *
 * En public/data/ no se escribe texto de ejemplo: las fichas sintéticas viven aquí.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aplicar, serializar, ErrorPanel } from '../panel/lib/aplicar.mjs';
import { SECCIONES, seccion, ordenar, clavesDeCarlos, CLAVES } from '../panel/lib/secciones.mjs';
import { promover, loQueFalta } from '../panel/lib/promover.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let pasan = 0;
const fallos = [];
const check = (n, cond, d = '') => { if (cond) pasan += 1; else fallos.push(`${n}${d ? ` — ${d}` : ''}`); };
const igual = (n, real, esp) =>
  check(n, JSON.stringify(real) === JSON.stringify(esp),
    `esperaba ${JSON.stringify(esp)}, obtuve ${JSON.stringify(real)}`);

// Ejecuta algo que debe fallar y comprueba el código y que el mensaje explica.
const debeFallar = (n, fn, codigo = 400, trozo = '') => {
  try {
    fn();
    fallos.push(`${n} — no falló, y debía`);
  } catch (e) {
    if (!(e instanceof ErrorPanel)) return fallos.push(`${n} — lanzó ${e.constructor.name}: ${e.message}`);
    if (e.codigo !== codigo) return fallos.push(`${n} — código ${e.codigo}, esperaba ${codigo}`);
    if (trozo && !e.message.includes(trozo)) return fallos.push(`${n} — el mensaje no dice "${trozo}": ${e.message}`);
    pasan += 1;
  }
};

// ============================================ 1. los datos reales, byte a byte
for (const clave of CLAVES) {
  const ruta = resolve(RAIZ, SECCIONES[clave].fichero);
  const crudo = readFileSync(ruta, 'utf8');
  const datos = JSON.parse(crudo);

  check(`${clave}: reserializa byte a byte`, serializar(datos) === crudo,
    `difiere en ${Math.abs(serializar(datos).length - crudo.length)} caracteres`);

  // Y reordenar una ficha que ya está en orden no la mueve.
  for (const [i, ficha] of datos.items.entries()) {
    igual(`${clave}[${i}]: ordenar() no reordena lo que ya está bien`,
      Object.keys(ordenar(ficha, clave)), Object.keys(ficha));
  }
}

// Control positivo: si `ordenar` no hiciera nada, esto lo cazaría.
{
  const desordenada = { title: 'x', id: 1, category: 'Visto' };
  igual('control positivo: ordenar() SÍ reordena lo desordenado',
    Object.keys(ordenar(desordenada, 'anime')), ['id', 'title', 'category']);
  // Y nunca pierde una clave que no conoce.
  igual('ordenar() conserva las claves desconocidas',
    Object.keys(ordenar({ id: 1, anilistIds: [9], title: 't' }, 'anime')),
    ['id', 'title', 'anilistIds']);
}

// ================================================= 2. la sección se valida bien
debeFallarSeccion('"novelas" no es una sección: es la URL', () => seccion('novelas'));
debeFallarSeccion('"novela" tampoco', () => seccion('novela'));
function debeFallarSeccion(n, fn) {
  try { fn(); fallos.push(`${n} — no falló`); } catch { pasan += 1; }
}
igual('la tercera sección se llama lightnovel', seccion('lightnovel').clave, 'lightnovel');
igual('lightnovel escribe en lightnovels.json', seccion('lightnovel').fichero, 'public/data/lightnovels.json');

// willReadSource es SÓLO de anime: 8 de 8 fichas de anime lo tienen, 0 en las otras.
check('willReadSource se ofrece en anime', clavesDeCarlos('anime').includes('willReadSource'));
check('willReadSource NO se ofrece en manga', !clavesDeCarlos('manga').includes('willReadSource'));
check('willReadSource NO se ofrece en novelas', !clavesDeCarlos('lightnovel').includes('willReadSource'));

// ==================================================== 3. escribir un campo suyo
const CTX = { hoy: '2026-09-03', nuevoId: 'e-prueba' };
const datosAnime = JSON.parse(readFileSync(resolve(RAIZ, 'public/data/anime.json'), 'utf8'));

{
  const antes = serializar(datosAnime);
  const { datos, ficha } = aplicar(datosAnime, { op: 'field.set', id: 8, campo: 'rating', valor: '9/10' }, 'anime', CTX);
  igual('field.set escribe el valor', ficha.rating, '9/10');
  check('field.set NO muta la entrada', serializar(datosAnime) === antes);
  check('field.set devuelve datos nuevos', datos !== datosAnime);
  igual('field.set no toca las demás fichas', datos.items.length, datosAnime.items.length);

  debeFallar('field.set rechaza un campo que no es suyo',
    () => aplicar(datosAnime, { op: 'field.set', id: 8, campo: 'title', valor: 'X' }, 'anime', CTX),
    400, 'no es un campo que escriba Carlos');
  debeFallar('field.set rechaza una categoría inventada',
    () => aplicar(datosAnime, { op: 'field.set', id: 8, campo: 'category', valor: 'Regulero' }, 'anime', CTX),
    400, 'desconocida');
  check('field.set acepta una categoría real',
    aplicar(datosAnime, { op: 'field.set', id: 8, campo: 'category', valor: 'Viendo' }, 'anime', CTX).ficha.category === 'Viendo');
  debeFallar('ficha inexistente da 404',
    () => aplicar(datosAnime, { op: 'field.set', id: 999, campo: 'rating', valor: '9/10' }, 'anime', CTX), 404);
}

// ======================================================== 4. el diario, añadir
{
  const { ficha } = aplicar(datosAnime,
    { op: 'entry.add', id: 5, entrada: { season: 1, episode: 7, rating: 9, text: '  con espacios  ' } },
    'anime', CTX);
  const e = ficha.entries.at(-1);
  igual('entry.add guarda el episodio', e.episode, 7);
  igual('entry.add guarda la nota como número', e.rating, 9);
  igual('entry.add recorta el texto', e.text, 'con espacios');
  igual('la fecha la pone el panel, no Carlos', e.date, '2026-09-03');
  igual('y el id también', e.id, 'e-prueba');

  // Sólo añade, nunca reescribe.
  const dos = aplicar(
    aplicar(datosAnime, { op: 'entry.add', id: 5, entrada: { episode: 1, text: 'a' } }, 'anime', CTX).datos,
    { op: 'entry.add', id: 5, entrada: { episode: 2, text: 'b' } }, 'anime', { ...CTX, nuevoId: 'e2' });
  igual('entry.add sólo añade', dos.ficha.entries.map((x) => x.text), ['a', 'b']);

  // La nota de una entrada es número; la de la obra es cadena. No se mezclan.
  igual('acepta la nota escrita como cadena y la guarda como número',
    aplicar(datosAnime, { op: 'entry.add', id: 5, entrada: { episode: 1, rating: '8.5' } }, 'anime', CTX)
      .ficha.entries.at(-1).rating, 8.5);

  debeFallar('rechaza una entrada vacía',
    () => aplicar(datosAnime, { op: 'entry.add', id: 5, entrada: { episode: 1 } }, 'anime', CTX),
    400, 'no dice nada');
  debeFallar('rechaza una nota fuera de 0-10',
    () => aplicar(datosAnime, { op: 'entry.add', id: 5, entrada: { episode: 1, rating: 42 } }, 'anime', CTX),
    400, 'de 0 a 10');
  debeFallar('rechaza un episodio que no es número',
    () => aplicar(datosAnime, { op: 'entry.add', id: 5, entrada: { episode: 'ocho', text: 'x' } }, 'anime', CTX),
    400, 'número');

  // LO IMPORTANTE: un nivel que la sección no declara se RECHAZA, no se guarda
  // por si acaso. Nada lo pintaría nunca y quedaría como basura en sus datos.
  debeFallar('anime no acepta "volume"',
    () => aplicar(datosAnime, { op: 'entry.add', id: 5, entrada: { volume: 2, text: 'x' } }, 'anime', CTX),
    400, 'no es un nivel');
}

{
  const datosManga = JSON.parse(readFileSync(resolve(RAIZ, 'public/data/manga.json'), 'utf8'));
  const { ficha } = aplicar(datosManga,
    { op: 'entry.add', id: 1, entrada: { volume: 3, chapter: 40, text: 'x' } }, 'manga', CTX);
  igual('manga usa volume y chapter', [ficha.entries[0].volume, ficha.entries[0].chapter], [3, 40]);
  debeFallar('manga NO acepta "season"',
    () => aplicar(datosManga, { op: 'entry.add', id: 1, entrada: { season: 1, text: 'x' } }, 'manga', CTX),
    400, 'no es un nivel');

  const datosNovela = JSON.parse(readFileSync(resolve(RAIZ, 'public/data/lightnovels.json'), 'utf8'));
  debeFallar('novelas NO aceptan "chapter" (sólo declaran volumen)',
    () => aplicar(datosNovela, { op: 'entry.add', id: 1, entrada: { chapter: 3, text: 'x' } }, 'lightnovel', CTX),
    400, 'no es un nivel');
  check('novelas sí aceptan volume',
    aplicar(datosNovela, { op: 'entry.add', id: 1, entrada: { volume: 3, text: 'x' } }, 'lightnovel', CTX)
      .ficha.entries[0].volume === 3);
}

// ================================================ 5. editar y borrar del diario
{
  const conUna = aplicar(datosAnime,
    { op: 'entry.add', id: 5, entrada: { episode: 1, text: 'original' } },
    'anime', { hoy: '2026-01-01', nuevoId: 'e-1' }).datos;

  const editada = aplicar(conUna,
    { op: 'entry.edit', id: 5, entradaId: 'e-1', entrada: { episode: 1, text: 'corregido' } },
    'anime', CTX);
  igual('entry.edit cambia el texto', editada.ficha.entries[0].text, 'corregido');
  igual('entry.edit CONSERVA la fecha original', editada.ficha.entries[0].date, '2026-01-01');
  igual('entry.edit no duplica', editada.ficha.entries.length, 1);

  debeFallar('entry.edit con id desconocido da 404',
    () => aplicar(conUna, { op: 'entry.edit', id: 5, entradaId: 'nope', entrada: { text: 'x' } }, 'anime', CTX), 404);

  const borrada = aplicar(conUna, { op: 'entry.remove', id: 5, entradaId: 'e-1' }, 'anime', CTX);
  igual('entry.remove borra', borrada.ficha.entries ?? [], []);
  // Y al quedarse vacío no deja un `entries: []` ensuciando el diff.
  check('al borrar la última, no queda un entries vacío', !('entries' in borrada.ficha));

  debeFallar('entry.remove con id desconocido da 404',
    () => aplicar(conUna, { op: 'entry.remove', id: 5, entradaId: 'nope' }, 'anime', CTX), 404);
}

// ================================== 6. el diario acaba en su sitio del ORDEN
{
  const { ficha } = aplicar(datosAnime,
    { op: 'entry.add', id: 5, entrada: { episode: 1, text: 'x' } }, 'anime', CTX);
  const claves = Object.keys(ficha);
  // anilistIds va detrás de entries porque asi esta DECLARADO en el orden, no
  // porque caiga al final por no conocerse.
  const original = Object.keys(datosAnime.items.find((i) => i.id === 5));
  igual('entries va justo antes de anilistIds',
    claves.slice(-2), ['entries', 'anilistIds']);
  igual('y no ha movido nada de lo que había',
    claves.filter((k) => k !== 'entries'), original);
}

// ======================================================= 7. operación inventada
debeFallar('rechaza una operación desconocida',
  () => aplicar(datosAnime, { op: 'borrar.todo', id: 5 }, 'anime', CTX), 400, 'desconocida');

// ============================================ 8. promocionar borradores
{
  const completo = () => ({
    title: 'Obra de prueba', japaneseTitle: 'テスト', genres: ['Comedia'],
    description: 'x', fullSynopsis: 'x', episodes: '1 temporada/12 episodios',
    hasManga: false, hasLightNovel: false, platforms: [], languages: [],
    image: '', openings: [], endings: [],
    category: '', rating: '', ratingFinal: '', personalOpinion: '',
    personalOpinionFinal: '', doIRecommend: '', willReadSource: '',
    _meta: { fuente: 'anilist', anilistIds: [999001], _revisar: ['episodes'], _avisos: [] },
  });

  const { ficha, revisar } = promover(datosAnime, completo(), { categoria: 'Viendo', clave: 'anime' });
  igual('promover pone el id siguiente', ficha.id,
    Math.max(...datosAnime.items.map((i) => i.id)) + 1);
  igual('promover pone la categoría', ficha.category, 'Viendo');
  igual('promover guarda los anilistIds', ficha.anilistIds, [999001]);
  igual('promover devuelve lo que hay que revisar', revisar, ['episodes']);
  check('promover quita _meta', !('_meta' in ficha));
  igual('promover ordena las claves', Object.keys(ficha)[0], 'id');
  check('promover NO muta los datos de entrada',
    datosAnime.items.every((i) => i.title !== 'Obra de prueba'));

  debeFallar('promover exige categoría',
    () => promover(datosAnime, completo(), { clave: 'anime' }), 400, 'falta la categoría');
  debeFallar('promover rechaza una categoría inventada',
    () => promover(datosAnime, completo(), { categoria: 'Regulero', clave: 'anime' }), 400, 'desconocida');

  // Este es el caso REAL de los 28 borradores de hoy: salieron del respaldo de
  // animethemes con AniList caído, y vienen sin géneros.
  const sinGeneros = { ...completo(), genres: [] };
  debeFallar('promover rechaza un borrador sin géneros',
    () => promover(datosAnime, sinGeneros, { categoria: 'Viendo', clave: 'anime' }),
    400, 'genres');
  igual('loQueFalta lo dice antes de pulsar el botón', loQueFalta(sinGeneros), ['genres']);
  igual('y de uno completo no dice nada', loQueFalta(completo()), []);

  // La máquina no escribe la voz de Carlos, ni por accidente.
  debeFallar('promover rechaza un borrador con opinión dentro',
    () => promover(datosAnime, { ...completo(), personalOpinion: 'me ha gustado' },
      { categoria: 'Viendo', clave: 'anime' }), 400, 'sólo escribe Carlos');
  debeFallar('promover rechaza un borrador con diario dentro',
    () => promover(datosAnime, { ...completo(), entries: [] },
      { categoria: 'Viendo', clave: 'anime' }), 400, 'diario');

  // Idempotencia por FRANQUICIA: publicar dos veces no duplica.
  const unaVez = promover(datosAnime, completo(), { categoria: 'Viendo', clave: 'anime' }).datos;
  debeFallar('promover no publica dos veces la misma franquicia',
    () => promover(unaVez, completo(), { categoria: 'Viendo', clave: 'anime' }),
    400, 'ya está publicada');

  // Cada sección tiene sus categorías: "Viendo" no vale para manga.
  const datosManga2 = JSON.parse(readFileSync(resolve(RAIZ, 'public/data/manga.json'), 'utf8'));
  debeFallar('las categorías de anime no valen en manga',
    () => promover(datosManga2, completo(), { categoria: 'Viendo', clave: 'manga' }),
    400, 'desconocida');
  check('pero las suyas sí',
    promover(datosManga2, completo(), { categoria: 'Leyendo', clave: 'manga' }).ficha.category === 'Leyendo');
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones del panel pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
