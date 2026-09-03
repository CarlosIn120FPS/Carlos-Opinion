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
import { enlazar } from '../panel/lib/hermanas.mjs';
import { anotar, quitar, de, serializarRevisar } from '../panel/lib/revisar.mjs';
import { clonar, esqueleto, COMUNES } from '../panel/lib/clonar.mjs';

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

// ============================================ 9. fichas hermanas: enlazar
// El enlace vive en LAS DOS fichas. Se prueba con datos sintéticos: en los
// reales aún no hay ningún par publicado en dos secciones a la vez.
{
  const anime = { categories: ['Visto'], items: [
    { id: 2, title: 'A2', category: 'Visto', hasManga: false, hasLightNovel: false, rating: '8/10' },
    { id: 3, title: 'A3', category: 'Visto', hasManga: true, hasLightNovel: false },
  ] };
  const manga = { categories: ['Leído'], items: [
    { id: 1, title: 'M1', category: 'Leído', hasAnime: true },
    { id: 5, title: 'M5', category: 'Leído', hasAnime: false },
  ] };
  const antes = serializar(anime) + serializar(manga);

  const uno = enlazar({ anime, manga }, { clave: 'anime', id: 2, hermana: 'manga', hermanaId: '1' });
  igual('enlazar escribe el lado del anime', uno.datos.anime.items[0].related, { manga: 1 });
  igual('y el lado del manga: el enlace es de ida y vuelta', uno.datos.manga.items[0].related, { anime: 2 });
  check('guarda el id REAL (número), no la cadena que llegó del <select>',
    uno.datos.anime.items[0].related?.manga === 1 && uno.datos.manga.items[0].related?.anime === 2);
  check('y pone la bandera a true en los dos lados',
    uno.datos.anime.items[0].hasManga === true && uno.datos.manga.items[0].hasAnime === true);
  check('enlazar NO muta la entrada', serializar(anime) + serializar(manga) === antes);
  igual('devuelve la ficha de este lado', uno.ficha.id, 2);
  igual('related va donde lo declara el orden, pegado a las banderas',
    Object.keys(uno.ficha).slice(0, 7), ['id', 'title', 'category', 'hasManga', 'hasLightNovel', 'related', 'rating']);
  check('no toca las fichas que no pinta nada',
    uno.datos.anime.items[1] === anime.items[1] && uno.datos.manga.items[1] === manga.items[1]);

  // Cambiar de hermana: la vieja pierde el enlace, la nueva lo gana.
  const dos = enlazar(uno.datos, { clave: 'anime', id: 2, hermana: 'manga', hermanaId: 5 });
  igual('al cambiar, el anime apunta a la nueva', dos.datos.anime.items[0].related, { manga: 5 });
  check('la hermana vieja pierde su enlace y no deja un related vacío',
    !('related' in dos.datos.manga.items[0]), JSON.stringify(dos.datos.manga.items[0]));
  igual('la nueva lo gana', dos.datos.manga.items[1].related, { anime: 2 });

  // Una tercera ficha que quiere la misma hermana: nunca dos fichas para una obra.
  const tres = enlazar(dos.datos, { clave: 'anime', id: 3, hermana: 'manga', hermanaId: 5 });
  igual('la hermana ahora apunta a la tercera', tres.datos.manga.items[1].related, { anime: 3 });
  check('y la anterior dueña del enlace lo pierde', !('related' in tres.datos.anime.items[0]),
    JSON.stringify(tres.datos.anime.items[0]));

  // Desenlazar: los dos lados limpios.
  const cero = enlazar(tres.datos, { clave: 'anime', id: 3, hermana: 'manga', hermanaId: '' });
  check('desenlazar quita el related de este lado', !('related' in cero.datos.anime.items[1]));
  check('y del otro', !('related' in cero.datos.manga.items[1]));
  check('pero la bandera se queda: la obra sigue existiendo', cero.datos.anime.items[1].hasManga === true);

  // Enlazar dos veces con la misma es idempotente.
  const otra = enlazar(uno.datos, { clave: 'anime', id: 2, hermana: 'manga', hermanaId: '1' });
  check('repetir el mismo enlace no cambia nada',
    serializar(otra.datos.anime) === serializar(uno.datos.anime) && serializar(otra.datos.manga) === serializar(uno.datos.manga));

  // Desde el otro lado funciona igual.
  const desdeManga = enlazar({ anime, manga }, { clave: 'manga', id: 5, hermana: 'anime', hermanaId: 3 });
  igual('desde manga: manga apunta al anime', desdeManga.datos.manga.items[1].related, { anime: 3 });
  igual('y el anime al manga', desdeManga.datos.anime.items[1].related, { manga: 5 });

  // Novela -> manga, el caso real que viene (Mushoku Tensei tiene manga). El
  // lado del manga recibe hasLightNovel y related EN SU SITIO del orden, no
  // colgando al final como una clave desconocida.
  const novela = { categories: ['Leída'], items: [
    { id: 1, title: 'N1', category: 'Leída', hasAnime: true, hasManga: true, doIRecommend: 'sí' },
  ] };
  const mangaConNovela = { categories: ['Leído'], items: [
    { id: 1, title: 'M1', category: 'Leído', hasAnime: true, doIRecommend: 'sí' },
  ] };
  const nm = enlazar({ lightnovel: novela, manga: mangaConNovela },
    { clave: 'lightnovel', id: 1, hermana: 'manga', hermanaId: 1 });
  igual('novela -> manga: la novela apunta al manga', nm.datos.lightnovel.items[0].related, { manga: 1 });
  igual('y el manga a la novela', nm.datos.manga.items[0].related, { lightnovel: 1 });
  igual('el manga gana hasLightNovel y related donde los declara su orden',
    Object.keys(nm.datos.manga.items[0]),
    ['id', 'title', 'category', 'hasAnime', 'hasLightNovel', 'related', 'doIRecommend']);

  // Lo que se rechaza.
  debeFallar('una hermana que la sección no declara es 400',
    () => enlazar({ anime, anime2: { items: [] } }, { clave: 'anime', id: 2, hermana: 'anime', hermanaId: 3 }),
    400, 'no es una sección hermana');
  debeFallar('una hermana que no existe es 404',
    () => enlazar({ anime, manga }, { clave: 'anime', id: 2, hermana: 'manga', hermanaId: 999 }),
    404, 'en manga');
  debeFallar('una ficha propia que no existe es 404',
    () => enlazar({ anime, manga }, { clave: 'anime', id: 999, hermana: 'manga', hermanaId: 1 }),
    404, 'en anime');
}

// ================================ 10. lo que hay que revisar sobrevive
{
  const r1 = anotar({}, 'anime', 12, { campos: ['episodes', 'description'], avisos: ['x'], fuente: 'anilist', hoy: '2026-09-03' });
  igual('anotar guarda campos, avisos, fuente y fecha', de(r1, 'anime', 12),
    { campos: ['episodes', 'description'], avisos: ['x'], fuente: 'anilist', fecha: '2026-09-03' });
  igual('el id se indexa como cadena y se busca con número o cadena', de(r1, 'anime', '12')?.fuente, 'anilist');
  check('sin nada que revisar no anota', anotar({}, 'anime', 1, { campos: [], avisos: [] }) !== null
    && Object.keys(anotar({}, 'anime', 1, { campos: [], avisos: [] })).length === 0);
  const r2 = anotar(r1, 'manga', 3, { campos: ['chapters'], hoy: '2026-09-03' });
  check('anotar no muta el registro anterior', !r1.manga);
  igual('quitar deja las demás', Object.keys(quitar(r2, 'anime', 12)), ['manga']);
  igual('quitar de una ficha que no está no cambia nada', quitar(r2, 'anime', 999), r2);
  check('quitar la última de una sección elimina la sección', !('manga' in quitar(r2, 'manga', 3)));
  igual('de() da null si no hay nada', de(r2, 'lightnovel', 1), null);
  check('serializa con salto final', serializarRevisar({}).endsWith('}\n'));
  debeFallarSeccion('una sección inventada revienta', () => anotar({}, 'novelas', 1, { campos: ['x'] }));
}

// ======================================= 11. clonar a manga / a novela
{
  // Una ficha real de anime (con opiniones y diario) para clonar.
  const origen = {
    ...datosAnime.items.find((i) => i.id === 2),
    rating: '9/10', personalOpinion: 'ME ENCANTA', entries: [{ id: 'e', date: '2026-01-01', episode: 1, text: 'x' }],
    hasManga: true, hasLightNovel: false,
  };
  const anime = { categories: ['Visto'], items: [origen, { id: 9, title: 'Otro', category: 'Visto' }] };
  const manga = { categories: ['Leído', 'Leyendo'], items: [{ id: 1, title: 'Chainsaw Man', category: 'Leído', hasAnime: true }] };

  const { datos, ficha } = clonar({ anime, manga }, { clave: 'anime', id: 2, hermana: 'manga', categoria: 'Leyendo' });
  igual('la ficha nueva tiene el id siguiente de manga', ficha.id, 2);
  igual('y la categoría elegida', ficha.category, 'Leyendo');
  for (const k of COMUNES) igual(`copia ${k}`, ficha[k], origen[k]);
  check('los géneros son una copia, no el mismo array', ficha.genres !== origen.genres);
  igual('hasAnime true: viene del anime', ficha.hasAnime, true);
  igual('hasLightNovel se copia del anime', ficha.hasLightNovel, false);
  igual('lo de manga queda vacío para rellenar', [ficha.chapters, ficha.volumes, ficha.author], ['', '', '']);
  igual('lo de Carlos queda vacío: su opinión del manga no es la del anime',
    [ficha.rating, ficha.ratingFinal, ficha.personalOpinion, ficha.personalOpinionFinal, ficha.doIRecommend], ['', '', '', '', '']);
  check('sin diario', !('entries' in ficha));
  check('sin anilistIds: los del anime no son los del manga', !('anilistIds' in ficha));
  check('sin willReadSource: no existe en manga', !('willReadSource' in ficha));
  igual('las claves siguen el orden de manga', Object.keys(ficha), [
    'id', 'title', 'japaneseTitle', 'category', 'image', 'description', 'genres', 'fullSynopsis',
    'chapters', 'volumes', 'author', 'hasAnime', 'hasLightNovel', 'related', 'doIRecommend',
    'platforms', 'languages', 'rating', 'ratingFinal', 'personalOpinion', 'personalOpinionFinal', 'physicalStores',
  ]);
  igual('enlazada al anime', ficha.related, { anime: 2 });
  igual('y el anime a ella', datos.anime.items[0].related, { manga: 2 });
  check('el anime conserva su diario y sus opiniones',
    datos.anime.items[0].personalOpinion === 'ME ENCANTA' && datos.anime.items[0].entries.length === 1);
  igual('manga tiene una ficha más', datos.manga.items.length, 2);
  check('no muta la entrada', anime.items[0].related === undefined && manga.items.length === 1);

  // Hacia novela, desde el anime: hasAnime true, hasManga copiado, illustrator vacío.
  const novela = { categories: ['Leída'], items: [] };
  const n = clonar({ anime, lightnovel: novela }, { clave: 'anime', id: 2, hermana: 'lightnovel', categoria: 'Leída' }).ficha;
  igual('a novela: banderas', [n.hasAnime, n.hasManga], [true, true]);
  igual('a novela: id 1 en una sección vacía', n.id, 1);
  check('a novela: illustrator vacío y sin chapters', n.illustrator === '' && !('chapters' in n));

  // Y desde manga hacia anime.
  const a = clonar({ manga, anime }, { clave: 'manga', id: 1, hermana: 'anime', categoria: 'Visto' }).ficha;
  igual('a anime desde manga: hasManga true, episodes vacío', [a.hasManga, a.episodes], [true, '']);
  check('a anime: openings y endings vacíos', Array.isArray(a.openings) && a.openings.length === 0 && Array.isArray(a.endings));

  // Lo que se rechaza.
  debeFallar('sin categoría', () => clonar({ anime, manga }, { clave: 'anime', id: 2, hermana: 'manga' }), 400, 'categoría');
  debeFallar('categoría de otra sección', () => clonar({ anime, manga }, { clave: 'anime', id: 2, hermana: 'manga', categoria: 'Visto' }), 400, 'desconocida');
  debeFallar('ya tiene hermana: no se duplica',
    () => clonar(datos, { clave: 'anime', id: 2, hermana: 'manga', categoria: 'Leído' }), 400, 'ya tiene ficha');
  debeFallar('ficha inexistente', () => clonar({ anime, manga }, { clave: 'anime', id: 999, hermana: 'manga', categoria: 'Leído' }), 404);
  debeFallar('sección que no es hermana', () => clonar({ anime, anime2: anime }, { clave: 'anime', id: 2, hermana: 'anime', categoria: 'Visto' }), 400, 'no es una sección hermana');
  igual('esqueleto no trae id ni category', ['id' in esqueleto(origen, 'anime', 'manga'), 'category' in esqueleto(origen, 'anime', 'manga')], [false, false]);
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones del panel pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
