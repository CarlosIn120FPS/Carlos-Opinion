// La bandeja de pendientes: qué episodios ha visto Carlos y todavía no ha
// comentado.
//
// El buzón es AniList, no Crunchyroll. Sus condiciones prohíben acceder al sitio
// «con cualquier motor, software, herramienta, agente o mecanismo que no sea el
// proporcionado por Ellation u otros navegadores», así que nuestro código no le
// habla nunca. Carlos marca el episodio en AniList —a mano o con una extensión
// que lo sincronice desde donde vea— y nosotros leemos de ahí, que es una API
// pública y pensada para clientes de terceros.
//
// Puro: ni fetch, ni DOM, ni reloj. Lo comprueba scripts/test-pendientes.mjs.
//
// LO QUE ESTO NO HACE, Y NO ES UN OLVIDO: no escribe opinión ni nota. Produce
// una fila con el localizador y la fecha puestos y el texto VACÍO. Y aunque
// quisiera no podría: aplicar.mjs rechaza toda entrada sin texto y sin nota.

// Formatos que cuentan como temporada. Una película o un OVA no es la temporada
// 3 de nada, así que no se numeran: van sin temporada y ya.
const FORMATOS_TEMPORADA = new Set(['TV', 'TV_SHORT']);

/**
 * Reparte números de temporada entre los ids de una franquicia.
 *
 * Los `anilistIds` de una ficha vienen del recorrido del grafo, que no es
 * cronológico. Aquí se ordenan las series por año y se numeran 1, 2, 3...; lo
 * que no sea serie se queda sin número.
 *
 * `formatos` es un Map id -> { format, year }.
 */
export function temporadasDe(anilistIds, formatos) {
  const series = (anilistIds ?? [])
    .map((id) => ({ id, ...(formatos.get(id) ?? {}) }))
    .filter((m) => FORMATOS_TEMPORADA.has(m.format))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id - b.id);

  const salida = new Map();
  series.forEach((m, i) => salida.set(m.id, i + 1));
  return salida;
}

const aFecha = (segundos) =>
  typeof segundos === 'number' && segundos > 0
    ? new Date(segundos * 1000).toISOString().slice(0, 10)
    : '';

/**
 * Los episodios vistos que aún no tienen entrada en el diario.
 *
 * `listas` son las entradas de AniList de esta ficha: { mediaId, progress, updatedAt }.
 * Devuelve las filas del más reciente al más antiguo.
 *
 * La fecha sólo se propone para el ÚLTIMO episodio de cada serie, que es el que
 * de verdad corresponde al `updatedAt`. Para los de atrás no se inventa: se
 * dejan sin fecha y el panel pondrá la de hoy si Carlos no dice otra cosa.
 */
export function filasPendientes(ficha, listas, formatos, { maxPorObra = 12 } = {}) {
  const temporadas = temporadasDe(ficha.anilistIds, formatos);
  const unaSolaTemporada = temporadas.size <= 1;

  // Lo ya escrito, para no volver a proponerlo.
  const escritas = new Set(
    (ficha.entries ?? [])
      .filter((e) => e && e.episode !== undefined && e.episode !== null)
      .map((e) => `${e.season ?? ''}#${e.episode}`),
  );

  const filas = [];
  for (const entrada of listas ?? []) {
    const progreso = Number(entrada?.progress) || 0;
    if (progreso <= 0) continue;

    // Con una sola temporada no se numera: la ficha de un anime de un cour
    // enseña "Episodio 7", no "Temporada 1 · Episodio 7".
    const temporada = unaSolaTemporada ? null : (temporadas.get(entrada.mediaId) ?? null);

    for (let ep = progreso; ep >= 1; ep -= 1) {
      const clave = `${temporada ?? ''}#${ep}`;
      if (escritas.has(clave)) continue;
      filas.push({
        fichaId: ficha.id,
        titulo: ficha.title,
        mediaId: entrada.mediaId,
        season: temporada,
        episode: ep,
        date: ep === progreso ? aFecha(entrada.updatedAt) : '',
        clave: `${ficha.id}:${clave}`,
      });
    }
  }

  // Lo más reciente primero: lo que acaba de ver es lo que quiere comentar.
  filas.sort((a, b) => (b.season ?? 0) - (a.season ?? 0) || b.episode - a.episode);

  const total = filas.length;
  return { filas: filas.slice(0, maxPorObra), total, recortadas: Math.max(0, total - maxPorObra) };
}

/**
 * La bandeja entera: recorre las fichas que tengan anilistIds y junta lo suyo.
 * Las fichas sin ids no pueden salir — no hay forma de cruzarlas con AniList.
 */
export function construirBandeja(items, listasPorId, formatos, opciones) {
  const bandeja = [];
  for (const ficha of items ?? []) {
    const ids = ficha.anilistIds ?? [];
    if (!ids.length) continue;
    const listas = ids.map((id) => listasPorId.get(id)).filter(Boolean);
    if (!listas.length) continue;
    const { filas, recortadas } = filasPendientes(ficha, listas, formatos, opciones);
    if (filas.length) bandeja.push({ ficha, filas, recortadas });
  }
  // La obra con algo más reciente, arriba.
  bandeja.sort((a, b) => (b.filas[0]?.date ?? '').localeCompare(a.filas[0]?.date ?? ''));
  return bandeja;
}

// --------------------------------------------------------- la consulta a AniList
// Una sola petición, sin autenticación: la documentación de AniList dice que para
// datos públicos no hace falta.
//
// Se usa `MediaListCollection` y NO `Page.mediaList`, aunque este último
// permitiría filtrar por ids y traer menos datos. Motivo, comprobado ejecutándolo:
//
//     User(name: "<inventado>")            -> 404 "Not Found."
//     MediaListCollection(userName: "...") -> 404 "User not found"
//     Page.mediaList(userName: "...")      -> 500 "Internal Server Error"
//
// Con `Page.mediaList` no se puede distinguir «has escrito mal el usuario» de
// «AniList está caído», y eso es lo primero que va a pasar cuando esto se
// configure. La lista entera de un usuario cabe de sobra en una petición y se
// filtra aquí por los ids que declaran las fichas.
export const CONSULTA = `
query ($usuario: String, $ids: [Int]) {
  MediaListCollection(userName: $usuario, type: ANIME) {
    lists {
      entries { mediaId progress status updatedAt }
    }
  }
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      format
      seasonYear
      startDate { year }
    }
  }
}`;

/** Convierte la respuesta cruda en lo que esperan las funciones de arriba. */
export function interpretar(datos) {
  const raiz = datos?.data ?? datos ?? {};
  const listasPorId = new Map();
  for (const lista of raiz.MediaListCollection?.lists ?? []) {
    for (const e of lista.entries ?? []) listasPorId.set(e.mediaId, e);
  }
  const formatos = new Map();
  for (const m of raiz.Page?.media ?? []) {
    formatos.set(m.id, { format: m.format, year: m.seasonYear ?? m.startDate?.year ?? 0 });
  }
  return { listasPorId, formatos };
}

/** Traduce el error de AniList a algo que se pueda leer y arreglar. */
export function explicarError(estado, errores) {
  const mensaje = errores?.[0]?.message ?? '';
  if (estado === 404 || /not found/i.test(mensaje)) {
    return 'AniList no encuentra ese usuario. Revisa cómo está escrito en panel.env.';
  }
  if (estado === 403 || estado === 401 || /private/i.test(mensaje)) {
    return 'Tu lista de AniList es privada. Ponla en pública o «unlisted» para que se pueda leer.';
  }
  if (estado === 429) return 'AniList está limitando las peticiones. Espera un minuto.';
  return `AniList ha respondido ${estado}${mensaje ? `: ${mensaje}` : ''}.`;
}
