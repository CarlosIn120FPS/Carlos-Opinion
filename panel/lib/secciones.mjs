// El ÚNICO mapa de secciones del panel.
//
// Las claves canónicas son `anime`, `manga` y `lightnovel` — las mismas que
// src/data/contentTypes.js y src/data/niveles.js. Ojo: la tercera NO es "novela"
// ni "novelas"; `novelas` es sólo el trozo de URL de la web pública. Aquí se
// indexa por la clave canónica y se lanza excepción si no existe, en vez de caer
// a anime por defecto como hace esquemaDe(): un fallo tipográfico que escribe en
// el fichero equivocado es lo peor que puede hacer esta herramienta.
//
// El ORDEN de claves está copiado del orden REAL de cada JSON (comprobado: las
// diez fichas de una sección comparten orden). Sirve para que el diff de git siga
// siendo legible y para que reescribir una ficha no la reordene entera. `related`
// (las fichas hermanas) va pegado a las banderas hasX porque habla de lo mismo.
//
// Puro: sin fs, sin http. Se puede probar desde node sin levantar nada.

export const SECCIONES = {
  anime: {
    clave: 'anime',
    etiqueta: 'Anime',
    fichero: 'public/data/anime.json',
    drafts: 'drafts/anime',
    // Los campos que sólo escribe Carlos. Ojo: `willReadSource` es SÓLO de anime
    // (comprobado: 8 de 8 fichas de anime lo tienen, 0 de manga y 0 de novelas).
    // Ofrecerlo en las otras dos inventaría un campo que no existe.
    campos: [
      { clave: 'category', tipo: 'categoria', etiqueta: 'Categoría' },
      { clave: 'rating', tipo: 'texto', etiqueta: 'Nota (mientras lo veo)' },
      { clave: 'ratingFinal', tipo: 'texto', etiqueta: 'Nota final' },
      { clave: 'personalOpinion', tipo: 'parrafo', etiqueta: 'Opinión (mientras lo veo)' },
      { clave: 'personalOpinionFinal', tipo: 'parrafo', etiqueta: 'Opinión final' },
      { clave: 'doIRecommend', tipo: 'parrafo', etiqueta: '¿Lo recomiendo?' },
      { clave: 'willReadSource', tipo: 'parrafo', etiqueta: '¿Voy a leer el manga/novela?' },
    ],
    orden: [
      'id', 'title', 'japaneseTitle', 'category', 'image', 'description', 'genres',
      'fullSynopsis', 'episodes', 'hasManga', 'hasLightNovel', 'related', 'willReadSource',
      'doIRecommend', 'platforms', 'languages', 'rating', 'ratingFinal',
      'personalOpinion', 'personalOpinionFinal', 'openings', 'endings', 'entries',
      'anilistIds',
    ],
  },
  manga: {
    clave: 'manga',
    etiqueta: 'Manga',
    fichero: 'public/data/manga.json',
    drafts: 'drafts/manga',
    campos: [
      { clave: 'category', tipo: 'categoria', etiqueta: 'Categoría' },
      { clave: 'rating', tipo: 'texto', etiqueta: 'Nota (mientras lo leo)' },
      { clave: 'ratingFinal', tipo: 'texto', etiqueta: 'Nota final' },
      { clave: 'personalOpinion', tipo: 'parrafo', etiqueta: 'Opinión (mientras lo leo)' },
      { clave: 'personalOpinionFinal', tipo: 'parrafo', etiqueta: 'Opinión final' },
      { clave: 'doIRecommend', tipo: 'parrafo', etiqueta: '¿Lo recomiendo?' },
    ],
    orden: [
      'id', 'title', 'japaneseTitle', 'category', 'image', 'description', 'genres',
      'fullSynopsis', 'chapters', 'volumes', 'author', 'hasAnime', 'hasLightNovel', 'related',
      'doIRecommend',
      'platforms', 'languages', 'rating', 'ratingFinal', 'personalOpinion',
      'personalOpinionFinal', 'physicalStores', 'entries', 'anilistIds',
    ],
  },
  lightnovel: {
    clave: 'lightnovel',
    etiqueta: 'Novelas ligeras',
    fichero: 'public/data/lightnovels.json',
    drafts: 'drafts/lightnovel',
    campos: [
      { clave: 'category', tipo: 'categoria', etiqueta: 'Categoría' },
      { clave: 'rating', tipo: 'texto', etiqueta: 'Nota (mientras la leo)' },
      { clave: 'ratingFinal', tipo: 'texto', etiqueta: 'Nota final' },
      { clave: 'personalOpinion', tipo: 'parrafo', etiqueta: 'Opinión (mientras la leo)' },
      { clave: 'personalOpinionFinal', tipo: 'parrafo', etiqueta: 'Opinión final' },
      { clave: 'doIRecommend', tipo: 'parrafo', etiqueta: '¿La recomiendo?' },
    ],
    orden: [
      'id', 'title', 'japaneseTitle', 'category', 'image', 'description', 'genres',
      'fullSynopsis', 'volumes', 'author', 'illustrator', 'hasAnime', 'hasManga', 'related',
      'doIRecommend', 'languages', 'rating', 'ratingFinal', 'personalOpinion',
      'personalOpinionFinal', 'physicalStores', 'entries', 'anilistIds',
    ],
  },
};

export const CLAVES = Object.keys(SECCIONES);

export function seccion(clave) {
  const s = SECCIONES[clave];
  if (!s) {
    throw new Error(
      `sección desconocida: "${clave}". Las válidas son ${CLAVES.join(', ')} ` +
        `(ojo: la tercera es "lightnovel", no "novelas" — eso es la URL).`,
    );
  }
  return s;
}

/** Los campos que Carlos rellena en una sección, sólo sus claves. */
export const clavesDeCarlos = (clave) => seccion(clave).campos.map((c) => c.clave);

/**
 * Reordena las claves de una ficha según el orden canónico, dejando al final y en
 * su orden original cualquier clave que no esté declarada (`anilistIds`, o lo que
 * venga mañana). Nunca pierde un campo.
 */
export function ordenar(ficha, clave) {
  const { orden } = seccion(clave);
  const salida = {};
  for (const k of orden) if (k in ficha) salida[k] = ficha[k];
  for (const k of Object.keys(ficha)) if (!(k in salida)) salida[k] = ficha[k];
  return salida;
}
