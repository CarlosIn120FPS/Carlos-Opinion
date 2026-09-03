// Enlazar dos fichas hermanas: la misma obra en dos secciones.
//
// El enlace es `related: { manga: 1 }` y vive en LAS DOS fichas, porque la web
// pública sólo tiene cargada la sección que está mirando: un enlace de un solo
// lado pintaría el botón en una dirección y no en la otra. Por eso esto no es un
// `field.set` más (que escribe una cadena en una ficha) sino una operación que
// toca dos ficheros a la vez, y por eso no ensancha la lista blanca de aplicar().
//
// PURO, como aplicar(): recibe los datos de las dos secciones y devuelve datos
// nuevos. Lanza ErrorPanel con 400 (petición mala) o 404 (ficha que no existe).

import { seccion, ordenar } from './secciones.mjs';
import { ErrorPanel } from './aplicar.mjs';
import { ESQUEMA } from '../../src/data/niveles.js';

const mal = (m) => {
  throw new ErrorPanel(400, m);
};

const indiceDe = (datos, id) => (datos.items ?? []).findIndex((it) => String(it.id) === String(id));
const mismoId = (a, b) => a !== null && a !== undefined && String(a) === String(b);

// Poner o quitar UNA entrada de `related`, sin dejar un `related: {}` vacío
// (mismo criterio que con `entries`: un mapa vacío no dice nada y ensucia el diff).
function conEnlace(ficha, hacia, id) {
  const bandera = ESQUEMA[hacia].bandera;
  return { ...ficha, [bandera]: true, related: { ...(ficha.related ?? {}), [hacia]: id } };
}
function sinEnlace(ficha, hacia) {
  const { [hacia]: _fuera, ...resto } = ficha.related ?? {};
  const salida = { ...ficha };
  if (Object.keys(resto).length) salida.related = resto;
  else delete salida.related;
  return salida;
}

/**
 * Enlaza la ficha `id` de la sección `clave` con la ficha `hermanaId` de la
 * sección `hermana`, o la desenlaza si `hermanaId` viene vacío.
 *
 *   todos: { anime: datosAnime, manga: datosManga, ... } — al menos las dos.
 *
 * Devuelve { datos: { [clave]: nuevos, [hermana]: nuevos }, ficha }.
 *
 * Mantiene la simetría: si la ficha estaba enlazada con otra, esa otra pierde su
 * enlace; y si la hermana nueva ya estaba enlazada con una tercera ficha de esta
 * sección, la tercera también lo pierde. Nunca quedan dos fichas apuntando a la
 * misma, ni un lado apuntando a quien no le devuelve el enlace.
 */
export function enlazar(todos, { clave, id, hermana, hermanaId }) {
  const s = seccion(clave);
  const permitidas = ESQUEMA[clave]?.hermanas ?? [];
  if (!permitidas.includes(hermana)) {
    mal(
      `"${hermana}" no es una sección hermana de ${s.etiqueta.toLowerCase()}. ` +
        `Puede tener: ${permitidas.join(', ')}.`,
    );
  }
  const datosA = todos?.[clave];
  const datosB = todos?.[hermana];
  if (!datosA || !datosB) throw new Error(`enlazar() necesita los datos de ${clave} y de ${hermana}`);

  const iA = indiceDe(datosA, id);
  if (iA === -1) throw new ErrorPanel(404, `no hay ninguna ficha con id ${id} en ${clave}`);

  const vacio = hermanaId === undefined || hermanaId === null || hermanaId === '';
  const itemsA = [...datosA.items];
  const itemsB = [...datosB.items];
  const anterior = itemsA[iA].related?.[hermana] ?? null;

  // 1. El lado viejo deja de devolver el enlace.
  if (anterior !== null && !(!vacio && mismoId(anterior, hermanaId))) {
    const j = indiceDe(datosB, anterior);
    if (j !== -1) itemsB[j] = ordenar(sinEnlace(itemsB[j], clave), hermana);
  }

  if (vacio) {
    itemsA[iA] = ordenar(sinEnlace(itemsA[iA], hermana), clave);
  } else {
    const jB = indiceDe(datosB, hermanaId);
    if (jB === -1) throw new ErrorPanel(404, `no hay ninguna ficha con id ${hermanaId} en ${hermana}`);
    const fichaB = itemsB[jB];

    // 2. Si la hermana ya apuntaba a OTRA ficha de esta sección, esa otra pierde
    //    su enlace: nunca dos fichas para la misma obra.
    const tercera = fichaB.related?.[clave] ?? null;
    if (tercera !== null && !mismoId(tercera, id)) {
      const k = indiceDe(datosA, tercera);
      if (k !== -1) itemsA[k] = ordenar(sinEnlace(itemsA[k], hermana), clave);
    }

    // 3. Los dos lados, con el id REAL de cada ficha (el del JSON, no lo que
    //    haya tecleado o elegido el cliente, que llega como cadena).
    itemsA[iA] = ordenar(conEnlace(itemsA[iA], hermana, fichaB.id), clave);
    itemsB[jB] = ordenar(conEnlace(fichaB, clave, itemsA[iA].id), hermana);
  }

  return {
    datos: {
      [clave]: { ...datosA, items: itemsA },
      [hermana]: { ...datosB, items: itemsB },
    },
    ficha: itemsA[iA],
  };
}
