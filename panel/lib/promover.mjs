// Promocionar un borrador del generador a una ficha publicada.
//
// Vive aquí y no dentro de scripts/promote.mjs para que haya UN SOLO camino que
// escriba en public/data/: el del comando y el del panel son el mismo código.
// Dos caminos que escriben lo mismo acaban divergiendo — ya pasó con la lógica
// de los ratings antes de src/lib/opinionFields.js.
//
// Puro: ni disco, ni red, ni reloj.

import { ordenar, seccion, clavesDeCarlos } from './secciones.mjs';
import { ErrorPanel } from './aplicar.mjs';

const mal = (m) => {
  throw new ErrorPanel(400, m);
};

/**
 * Qué le falta a un borrador para poder publicarse. Devuelve una lista de
 * motivos, vacía si está listo. Se usa también para pintar la lista del panel:
 * es mejor decir por qué NO se puede antes de que pulse el botón.
 */
export function loQueFalta(borrador) {
  const faltan = [];
  for (const campo of ['title', 'japaneseTitle']) {
    if (!borrador?.[campo]) faltan.push(campo);
  }
  if (!borrador?.genres?.length) faltan.push('genres');
  return faltan;
}

/**
 * Promociona `borrador` dentro de `datos`. Devuelve { datos, ficha } nuevos.
 *
 * La idempotencia es por FRANQUICIA, no por obra: si ya publicaste la temporada
 * 1, la 2 no crea una ficha nueva.
 */
export function promover(datos, borrador, { categoria, clave }) {
  seccion(clave);

  const validas = datos.categories ?? [];
  // La categoría es obligatoria a propósito. Sin ella habría que inventarse un
  // "No visto" provisional que miente, o dejarla vacía y que la ficha
  // desaparezca en silencio de la web. Es la primera decisión, y es suya.
  if (!categoria) mal('falta la categoría. Es tuya: nadie puede deducir si lo has visto.');
  if (!validas.includes(categoria)) {
    mal(`categoría "${categoria}" desconocida. Válidas: ${validas.join(', ')}.`);
  }

  const faltan = loQueFalta(borrador);
  if (faltan.length) {
    mal(
      `al borrador le falta ${faltan.join(', ')}. Suele significar que se generó ` +
        `con AniList caído y salió del respaldo: vuelve a generarlo.`,
    );
  }

  const meta = borrador._meta ?? {};
  const idsBorrador = new Set(meta.anilistIds ?? []);
  if (idsBorrador.size) {
    const yaEsta = (datos.items ?? []).find((it) =>
      (it.anilistIds ?? []).some((id) => idsBorrador.has(id)),
    );
    if (yaEsta) {
      mal(`esta franquicia ya está publicada como «${yaEsta.title}» (ficha ${yaEsta.id}).`);
    }
  }

  const { _meta, ...ficha } = borrador;

  // La máquina no escribe la voz de Carlos. El generador ya los deja vacíos,
  // pero esa garantía vive allí: aquí se comprueba en la puerta.
  const intrusos = clavesDeCarlos(clave).filter((c) => c !== 'category' && ficha[c]);
  if (intrusos.length) {
    mal(`el borrador trae campos que sólo escribe Carlos: ${intrusos.join(', ')}.`);
  }
  if ('entries' in ficha) mal('el borrador trae un diario. La máquina no escribe ahí, nunca.');

  // App.jsx ordena con (a.id - b.id): tiene que ser número, no cadena.
  ficha.id = Math.max(0, ...(datos.items ?? []).map((i) => Number(i.id) || 0)) + 1;
  ficha.category = categoria;
  if (meta.anilistIds?.length) ficha.anilistIds = meta.anilistIds;

  const ordenada = ordenar(ficha, clave);
  return {
    datos: { ...datos, items: [...(datos.items ?? []), ordenada] },
    ficha: ordenada,
    revisar: meta._revisar ?? [],
    avisos: meta._avisos ?? [],
  };
}
