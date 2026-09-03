// El corazón del panel: aplicar una operación a los datos de una sección.
//
// PURO a propósito — no toca disco, no toca red, no mira el reloj. La fecha y el
// id de una entrada entran como argumentos, porque si los generase aquí dentro
// esto dejaría de ser comprobable. Todo lo que escribe en el JSON de Carlos pasa
// por esta función, así que es la que tiene que estar probada de verdad.
//
// No muta la entrada: devuelve datos nuevos. Si algo va mal, lanza un ErrorPanel
// con un código, y el servidor lo traduce a un 400 o un 404.

import { seccion, clavesDeCarlos, ordenar } from './secciones.mjs';
import { ESQUEMA } from '../../src/data/niveles.js';

export class ErrorPanel extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo; // 400 = lo has pedido mal · 404 = no existe
  }
}

const mal = (m) => {
  throw new ErrorPanel(400, m);
};

const texto = (v) => (typeof v === 'string' ? v : '');

// Las claves localizadoras válidas de cada sección salen de niveles.js, que es lo
// mismo que lee la web pública. Así no puede haber dos verdades.
const localizadoresDe = (clave) => (ESQUEMA[clave]?.levels ?? []).map((n) => n.key);

/**
 * Valida y normaliza una entrada del diario.
 *
 * La fecha la pone el panel (llega en `hoy`), NO Carlos: es lo que dice
 * docs/esquema-ficha.md y lo que evita que teclee una fecha para escribir dos
 * frases. El id también, para poder editarla luego.
 */
function limpiarEntrada(bruta, clave, { hoy, id }) {
  if (!bruta || typeof bruta !== 'object' || Array.isArray(bruta)) {
    mal('la entrada tiene que ser un objeto');
  }

  const permitidos = localizadoresDe(clave);
  const salida = {};

  if (id) salida.id = id;
  salida.date = texto(bruta.date) || hoy;

  // Localizadores: sólo los que la sección declara. Un `season` en manga no se
  // guarda "por si acaso" — se rechaza, porque nada lo pintaría nunca y quedaría
  // como basura silenciosa dentro de sus datos.
  for (const nivel of permitidos) {
    if (bruta[nivel] === undefined || bruta[nivel] === null || bruta[nivel] === '') continue;
    const n = Number(bruta[nivel]);
    if (!Number.isFinite(n) || n < 0) mal(`"${nivel}" tiene que ser un número (llegó ${JSON.stringify(bruta[nivel])})`);
    salida[nivel] = n;
  }
  for (const k of Object.keys(bruta)) {
    if (['id', 'date', 'text', 'rating'].includes(k)) continue;
    if (permitidos.includes(k)) continue;
    mal(
      `"${k}" no es un nivel de ${seccion(clave).etiqueta.toLowerCase()}. ` +
        `Los válidos son: ${permitidos.join(', ') || '(ninguno)'}.`,
    );
  }

  // La nota de una entrada es un NÚMERO (la de la obra es una cadena "9/10", y
  // esa distinción es del esquema, no un descuido).
  if (bruta.rating !== undefined && bruta.rating !== null && bruta.rating !== '') {
    const n = Number(bruta.rating);
    if (!Number.isFinite(n)) mal('la nota tiene que ser un número');
    if (n < 0 || n > 10) mal('la nota va de 0 a 10');
    salida.rating = n;
  }

  const t = texto(bruta.text).trim();
  if (t) salida.text = t;

  if (!salida.text && salida.rating === undefined) {
    mal('una entrada sin texto y sin nota no dice nada');
  }

  return salida;
}

const buscarFicha = (datos, id) => {
  const i = (datos.items ?? []).findIndex((it) => String(it.id) === String(id));
  if (i === -1) throw new ErrorPanel(404, `no hay ninguna ficha con id ${id}`);
  return i;
};

/**
 * Aplica una operación. Devuelve { datos, ficha } nuevos.
 *
 *   { op: 'field.set',    id, campo, valor }
 *   { op: 'entry.add',    id, entrada }
 *   { op: 'entry.edit',   id, entradaId, entrada }
 *   { op: 'entry.remove', id, entradaId }
 */
export function aplicar(datos, op, clave, { hoy, nuevoId } = {}) {
  seccion(clave); // valida la sección antes que nada
  if (!op || typeof op !== 'object') mal('falta la operación');

  const i = buscarFicha(datos, op.id);
  const original = datos.items[i];
  let ficha;

  switch (op.op) {
    case 'field.set': {
      if (!clavesDeCarlos(clave).includes(op.campo)) {
        mal(
          `"${op.campo}" no es un campo que escriba Carlos en ${seccion(clave).etiqueta.toLowerCase()}. ` +
            `Los suyos son: ${clavesDeCarlos(clave).join(', ')}.`,
        );
      }
      if (typeof op.valor !== 'string') mal('el valor tiene que ser texto');
      if (op.campo === 'category') {
        const validas = datos.categories ?? [];
        if (!validas.includes(op.valor)) {
          mal(`categoría "${op.valor}" desconocida. Válidas: ${validas.join(', ')}.`);
        }
      }
      ficha = { ...original, [op.campo]: op.valor };
      break;
    }

    case 'entry.add': {
      const entrada = limpiarEntrada(op.entrada, clave, { hoy, id: nuevoId });
      ficha = { ...original, entries: [...(original.entries ?? []), entrada] };
      break;
    }

    case 'entry.edit': {
      const lista = original.entries ?? [];
      const j = lista.findIndex((e) => e?.id && e.id === op.entradaId);
      if (j === -1) throw new ErrorPanel(404, `no hay ninguna entrada con id ${op.entradaId}`);
      // Se conserva la fecha original: editar una nota no la mueve en el tiempo.
      const entrada = limpiarEntrada(
        { ...op.entrada, date: op.entrada?.date ?? lista[j].date },
        clave,
        { hoy, id: op.entradaId },
      );
      const entries = [...lista];
      entries[j] = entrada;
      ficha = { ...original, entries };
      break;
    }

    case 'entry.remove': {
      const lista = original.entries ?? [];
      const entries = lista.filter((e) => e?.id !== op.entradaId);
      if (entries.length === lista.length) {
        throw new ErrorPanel(404, `no hay ninguna entrada con id ${op.entradaId}`);
      }
      ficha = { ...original, entries };
      break;
    }

    default:
      mal(`operación desconocida: "${op.op}"`);
  }

  // Un diario vacío no es un diario: se quita la clave en vez de dejar un
  // `entries: []`. Vale tanto para la ficha que nunca tuvo diario como para
  // aquella a la que se le acaba de borrar la última entrada, y normalize.js
  // devuelve [] igual cuando el campo no está, así que la web no nota nada.
  if (Array.isArray(ficha.entries) && ficha.entries.length === 0) {
    delete ficha.entries;
  }

  const items = [...datos.items];
  items[i] = ordenar(ficha, clave);
  return { datos: { ...datos, items }, ficha: items[i] };
}

/**
 * Serializa como lo hace promote.mjs: dos espacios y salto final. Que el panel y
 * el promotor escriban byte a byte igual es lo que evita que un diff de git salga
 * lleno de ruido según quién tocara la ficha por última vez.
 */
export const serializar = (datos) => `${JSON.stringify(datos, null, 2)}\n`;
