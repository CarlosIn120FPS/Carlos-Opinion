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
// Qué secciones son hermanas de cuál, y con qué bandera (`hasManga`) se dice que
// la obra existe allí, lo declara ESQUEMA: es lo mismo que lee el panel.
//
// Puro: sin React ni import.meta.

import { ESQUEMA } from '../data/niveles';

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
  return (ESQUEMA[typeId]?.hermanas ?? []).map((seccion) => {
    const { nombre, genero, bandera } = ESQUEMA[seccion];
    const id = item?.related?.[seccion];
    const tieneId = id !== undefined && id !== null && id !== '';
    // «Ver el manga» / «Ver la novela ligera»; «no lo he reseñado» / «no la he».
    const articulo = genero === 'f' ? 'la' : 'el';
    const pronombre = genero === 'f' ? 'la' : 'lo';
    return {
      seccion,
      nombre,
      pregunta: `¿Tiene ${nombre}?`,
      id: tieneId ? id : null,
      estado: tieneId ? 'ficha' : (item?.[bandera] ? 'existe' : 'no'),
      etiqueta: tieneId
        ? `Ver ${articulo} ${nombre} →`
        : (item?.[bandera] ? `Sí, pero aún no ${pronombre} he reseñado` : 'No'),
    };
  });
}
