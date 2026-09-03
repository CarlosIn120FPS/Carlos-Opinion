// Fichas hermanas: la misma obra en otra sección.
//
// Hasta ahora el modal afirmaba «Tiene manga: Sí» y no llevaba a ninguna parte,
// ni siquiera cuando la ficha del manga existía. Y peor: `hasManga ? 'Sí' : 'No'`
// pinta «No» tanto si de verdad no hay manga como si el campo falta — o sea que
// mentía por omisión.
//
// Ahora son TRES estados, y el enlace es EXPLÍCITO. Nunca se adivina por título:
// eso ya se probó y emparejó «Call of the Night» con Shimoneta.
//
// Puro: sin React ni import.meta.

import { ESQUEMA } from '../data/niveles';

// Qué hermanas puede tener cada sección, y de qué campo sale el «sí la hay».
const HERMANAS = {
  anime: [
    { seccion: 'manga', bandera: 'hasManga' },
    { seccion: 'lightnovel', bandera: 'hasLightNovel' },
  ],
  manga: [{ seccion: 'anime', bandera: 'hasAnime' }],
  lightnovel: [
    { seccion: 'anime', bandera: 'hasAnime' },
    { seccion: 'manga', bandera: 'hasManga' },
  ],
};

/**
 * Devuelve una entrada por cada hermana posible de la sección, con su estado:
 *
 *   'ficha'  hay ficha escrita y se puede ir     -> { id }
 *   'existe' la obra existe pero no la ha reseñado
 *   'no'     no existe
 *
 * `related` es un mapa explícito { manga: 1, lightnovel: 3 } con el id de la
 * ficha al otro lado.
 */
export function hermanas(item, typeId) {
  return (HERMANAS[typeId] ?? []).map(({ seccion, bandera }) => {
    const esquema = ESQUEMA[seccion];
    const id = item?.related?.[seccion];
    const tieneId = id !== undefined && id !== null && id !== '';
    return {
      seccion,
      nombre: esquema.nombre,
      slug: esquema.slug,
      pregunta: `¿Tiene ${esquema.nombre}?`,
      id: tieneId ? id : null,
      estado: tieneId ? 'ficha' : (item?.[bandera] ? 'existe' : 'no'),
      etiqueta: tieneId
        ? `Ver ${esquema.nombre === 'anime' ? 'el' : esquema.nombre === 'manga' ? 'el' : 'la'} ${esquema.nombre} →`
        : (item?.[bandera] ? 'Sí, pero aún no lo he reseñado' : 'No'),
    };
  });
}
