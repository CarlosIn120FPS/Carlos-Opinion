// «Clonar a manga»: crear la ficha hermana de una obra a partir de la que ya
// existe en otra sección, ya enlazada en las dos direcciones.
//
// Lo que se copia es lo OBJETIVO y común (título, título japonés, portada,
// descripción, géneros, sinopsis). Lo que es de cada sección (episodios,
// capítulos, autor...) queda vacío para que lo rellene él o el generador, y lo
// que sólo escribe Carlos (notas, opiniones) también: es otra obra distinta y
// su opinión sobre el manga no es su opinión sobre el anime.
//
// No se copian anilistIds: los del anime no son los del manga, y copiarlos
// rompería la detección de duplicados al publicar borradores.
//
// PURO: recibe los datos de las dos secciones y devuelve datos nuevos.

import { seccion, ordenar, clavesDeCarlos } from './secciones.mjs';
import { ErrorPanel } from './aplicar.mjs';
import { enlazar } from './hermanas.mjs';
import { ESQUEMA } from '../../src/data/niveles.js';

const mal = (m) => {
  throw new ErrorPanel(400, m);
};

// Los campos que significan lo mismo en las tres secciones.
export const COMUNES = ['title', 'japaneseTitle', 'image', 'description', 'genres', 'fullSynopsis'];

// Lo que nunca se copia: lo pone el propio proceso o no tiene sentido copiarlo.
const NUNCA = new Set(['id', 'category', 'related', 'entries', 'anilistIds']);
const LISTAS = new Set(['genres', 'platforms', 'languages', 'openings', 'endings', 'physicalStores']);

/** El esqueleto de una ficha nueva de `hermana`, rellenado desde `origen`. */
export function esqueleto(origen, clave, hermana) {
  const { orden } = seccion(hermana);
  const deCarlos = new Set(clavesDeCarlos(hermana));
  const ficha = {};
  for (const k of orden) {
    if (NUNCA.has(k)) continue;
    if (COMUNES.includes(k)) {
      ficha[k] = LISTAS.has(k) ? [...(origen[k] ?? [])] : (origen[k] ?? '');
    } else if (k === ESQUEMA[clave].bandera) {
      ficha[k] = true; // la obra existe en la sección de origen: es de donde viene
    } else if (k.startsWith('has')) {
      ficha[k] = Boolean(origen[k]);
    } else if (LISTAS.has(k)) {
      ficha[k] = [];
    } else if (deCarlos.has(k)) {
      ficha[k] = '';
    } else {
      ficha[k] = ''; // episodes, chapters, volumes, author, illustrator...
    }
  }
  return ficha;
}

/**
 * Crea en `hermana` la ficha hermana de la ficha `id` de `clave`, con la
 * `categoria` elegida por Carlos, y las enlaza. Devuelve
 * { datos: { [clave], [hermana] }, ficha: la nueva }.
 */
export function clonar(todos, { clave, id, hermana, categoria }) {
  seccion(clave);
  const permitidas = ESQUEMA[clave]?.hermanas ?? [];
  if (!permitidas.includes(hermana)) {
    mal(`"${hermana}" no es una sección hermana de ${seccion(clave).etiqueta.toLowerCase()}. Puede tener: ${permitidas.join(', ')}.`);
  }
  const datosA = todos?.[clave];
  const datosB = todos?.[hermana];
  if (!datosA || !datosB) throw new Error(`clonar() necesita los datos de ${clave} y de ${hermana}`);

  const origen = (datosA.items ?? []).find((it) => String(it.id) === String(id));
  if (!origen) throw new ErrorPanel(404, `no hay ninguna ficha con id ${id} en ${clave}`);

  const yaTiene = origen.related?.[hermana];
  if (yaTiene !== undefined && yaTiene !== null && yaTiene !== '') {
    mal(`«${origen.title}» ya tiene ficha de ${ESQUEMA[hermana].nombre} (la ${yaTiene}). Enlázala o desenlázala, pero no la dupliques.`);
  }

  if (!categoria) mal('falta la categoría. Es tuya: nadie puede deducir si lo has leído.');
  const validas = datosB.categories ?? [];
  if (!validas.includes(categoria)) mal(`categoría "${categoria}" desconocida en ${hermana}. Válidas: ${validas.join(', ')}.`);

  const nueva = esqueleto(origen, clave, hermana);
  nueva.id = Math.max(0, ...(datosB.items ?? []).map((i) => Number(i.id) || 0)) + 1;
  nueva.category = categoria;

  const conNueva = { ...datosB, items: [...(datosB.items ?? []), ordenar(nueva, hermana)] };
  const { datos } = enlazar({ [clave]: datosA, [hermana]: conNueva }, { clave, id, hermana, hermanaId: nueva.id });
  const ficha = datos[hermana].items.find((it) => it.id === nueva.id);
  return { datos, ficha };
}
