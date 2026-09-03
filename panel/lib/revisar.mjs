// Lo que propuso la máquina y Carlos aún no ha mirado.
//
// El generador marca en `_meta._revisar` los campos que rellenó con menos
// certeza (episodes, description, genres...). Al publicar, promover() quita
// `_meta` de la ficha —en la web no pinta nada— y hasta ahora esa lista se
// perdía: una ficha recién publicada con un `chapters` dudoso se veía idéntica a
// una que Carlos revisó entera.
//
// Ahora vive en panel/revisar.json, FUERA de public/: es una nota para el panel,
// no un dato de la ficha. Se commitea con la ficha para que el PC y el móvil
// vean lo mismo.
//
// Forma:  { anime: { "12": { campos: [...], avisos: [...], fuente, fecha } } }
//
// Puro: ni disco ni reloj.

import { seccion } from './secciones.mjs';

export const FICHERO_REVISAR = 'panel/revisar.json';

/** Anota que la ficha `id` de `clave` tiene cosas que revisar. Sin nada, no anota. */
export function anotar(registro, clave, id, { campos = [], avisos = [], fuente = '', hoy } = {}) {
  seccion(clave);
  if (!campos.length && !avisos.length) return registro ?? {};
  const previo = registro ?? {};
  return {
    ...previo,
    [clave]: {
      ...(previo[clave] ?? {}),
      [String(id)]: { campos: [...campos], avisos: [...avisos], fuente, fecha: hoy ?? '' },
    },
  };
}

/** Carlos ya lo ha mirado: fuera. Una sección que se queda vacía desaparece. */
export function quitar(registro, clave, id) {
  seccion(clave);
  const previo = registro ?? {};
  if (!previo[clave]?.[String(id)]) return previo;
  const { [String(id)]: _fuera, ...resto } = previo[clave];
  const salida = { ...previo };
  if (Object.keys(resto).length) salida[clave] = resto;
  else delete salida[clave];
  return salida;
}

/** Lo pendiente de una ficha, o null. */
export const de = (registro, clave, id) => registro?.[clave]?.[String(id)] ?? null;

/** Serializa como los demás ficheros del panel: dos espacios y salto final. */
export const serializarRevisar = (registro) => `${JSON.stringify(registro ?? {}, null, 2)}\n`;
