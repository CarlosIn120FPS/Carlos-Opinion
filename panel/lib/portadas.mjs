// Portadas locales: traer a public/covers/ las imágenes que hoy cuelgan de CDNs
// ajenos (Crunchyroll, Netflix, MyAnimeList, AniList...). Esas URLs llevan tokens
// que rotan y, cuando una caduca, nadie se entera: CoverImage.jsx pinta un
// recuadro gris con el título y a otra cosa.
//
// PURO con IO inyectado: `descargar(url)` y `escribir(nombre, bytes)` los pone
// quien llama (scripts/portadas.mjs con fetch y fs; los tests con mocks). Así el
// criterio —qué se baja, qué se acepta, qué se reintenta— se prueba sin red.
//
// Reglas:
//  - Nunca se deja `image` en blanco. Si la descarga falla, la ficha se queda con
//    su URL, que es mejor que nada. Lo contrario lo hace generar.py con los
//    borradores, y allí tiene sentido: aún no se ha publicado.
//  - El tipo sale de los primeros bytes, no de la extensión de la URL:
//    Crunchyroll sirve `format=auto` y decide según la cabecera Accept.
//  - La procedencia (URL original, fecha, bytes, fallos) va a un fichero aparte,
//    public/covers/origen.json. En la ficha no se inventa ningún campo.
//  - Un fallo PERMANENTE (404, no es una imagen, demasiado grande) se anota y no
//    se reintenta solo; uno de red se reintenta la próxima vez.

import { seccion, ordenar } from './secciones.mjs';

export const CARPETA = 'public/covers';
export const FICHERO_ORIGEN = 'public/covers/origen.json';
export const TAMANO_MAX = 6 * 1024 * 1024;
export const INTENTOS_MAX = 3;

export const esExterna = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);
export const esLocal = (url) => typeof url === 'string' && url.startsWith('covers/');

/** 'jpg' | 'png' | 'webp' | 'gif' | null, por los bytes mágicos. */
export function tipoDeImagen(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const b = (i) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpg';
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'png';
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return 'gif';
  if (
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) return 'webp';
  return null;
}

export const claveOrigen = (clave, id) => `${clave}-${id}`;
export const nombreDe = (clave, id, ext) => `${claveOrigen(clave, id)}.${ext}`;

/** Un error de descarga que no merece reintento (404, no es imagen, muy grande). */
export class FalloPermanente extends Error {}

/**
 * Las fichas de una sección cuya portada sigue fuera y que toca intentar bajar.
 * Se salta las que ya fallaron INTENTOS_MAX veces con la misma URL: una URL
 * muerta no se vuelve a pedir cada dos minutos para siempre.
 */
export function pendientesDe(datos, clave, origen = {}) {
  seccion(clave);
  return (datos.items ?? [])
    .filter((it) => esExterna(it.image))
    .filter((it) => {
      const previo = origen[claveOrigen(clave, it.id)];
      return !(previo?.fallo && previo.url === it.image && (previo.intentos ?? 0) >= INTENTOS_MAX);
    })
    .map((it) => ({ id: it.id, title: it.title, url: it.image, anilistIds: it.anilistIds ?? [] }));
}

// Baja una URL y comprueba que lo que llega es una imagen aceptable.
async function traer(url, descargar) {
  const bytes = await descargar(url);
  if (!bytes || bytes.length === 0) throw new FalloPermanente('respuesta vacía');
  if (bytes.length > TAMANO_MAX) throw new FalloPermanente(`${bytes.length} bytes, más de ${TAMANO_MAX}`);
  const ext = tipoDeImagen(bytes);
  if (!ext) throw new FalloPermanente('la respuesta no es una imagen (jpg/png/webp/gif)');
  return { bytes, ext };
}

/** La ficha `id` pasa a apuntar a su portada local. No muta la entrada. */
export function aplicarPortada(datos, clave, id, ruta) {
  const i = (datos.items ?? []).findIndex((it) => String(it.id) === String(id));
  if (i === -1) throw new Error(`no hay ficha ${id} en ${clave}`);
  const items = [...datos.items];
  items[i] = ordenar({ ...items[i], image: ruta }, clave);
  return { ...datos, items };
}

/**
 * Baja las portadas externas de varias secciones.
 *
 *   datosPorClave: { anime: datos, manga: datos, ... }
 *   origen:        el contenido de origen.json (o {})
 *   descargar:     async (url) => Uint8Array   (lanza FalloPermanente o Error)
 *   escribir:      async (nombre, bytes) => void
 *   alternativa:   async ({ clave, id, anilistIds }) => url | null   (opcional)
 *                  Sólo se consulta si la URL de la ficha falla de forma
 *                  PERMANENTE: la portada de la misma obra en AniList, que es la
 *                  fuente de la que salen las fichas nuevas. Una ficha que ya
 *                  tiene su portada no se cambia por la de AniList.
 *   hoy:           'AAAA-MM-DD'
 *
 * Devuelve { datosPorClave: sólo las secciones que cambian, origen: nuevo,
 * informe: [{ clave, id, title, estado: 'ok'|'fallo'|'reintentar', detalle }] }.
 */
export async function localizar({ datosPorClave, origen = {}, descargar, escribir, alternativa, hoy }) {
  const salida = {};
  const nuevoOrigen = { ...origen };
  const informe = [];

  for (const [clave, datos] of Object.entries(datosPorClave)) {
    let actual = datos;
    for (const { id, title, url, anilistIds } of pendientesDe(datos, clave, origen)) {
      const k = claveOrigen(clave, id);
      const previo = nuevoOrigen[k] ?? {};
      const intentos = previo.url === url ? (previo.intentos ?? 0) : 0;
      try {
        let origenReal = url;
        let imagen;
        try {
          imagen = await traer(url, descargar);
        } catch (e) {
          // Si la URL está muerta de verdad, la misma obra en AniList.
          const otra = e instanceof FalloPermanente && alternativa
            ? await alternativa({ clave, id, anilistIds }).catch(() => null)
            : null;
          if (!otra || otra === url) throw e;
          imagen = await traer(otra, descargar);
          origenReal = otra;
        }
        const { bytes, ext } = imagen;
        const nombre = nombreDe(clave, id, ext);
        await escribir(nombre, bytes);
        actual = aplicarPortada(actual, clave, id, `covers/${nombre}`);
        nuevoOrigen[k] = { url: origenReal, fichero: nombre, fecha: hoy, bytes: bytes.length };
        if (origenReal !== url) nuevoOrigen[k].sustituye = url;
        informe.push({
          clave, id, title, estado: 'ok',
          detalle: `${nombre} (${bytes.length} bytes)${origenReal !== url ? ', desde AniList porque la original está muerta' : ''}`,
        });
      } catch (e) {
        const permanente = e instanceof FalloPermanente;
        nuevoOrigen[k] = {
          url, fallo: e.message, fecha: hoy,
          intentos: permanente ? INTENTOS_MAX : intentos + 1,
        };
        informe.push({ clave, id, title, estado: permanente ? 'fallo' : 'reintentar', detalle: e.message });
      }
    }
    if (actual !== datos) salida[clave] = actual;
  }

  return { datosPorClave: salida, origen: nuevoOrigen, informe };
}
