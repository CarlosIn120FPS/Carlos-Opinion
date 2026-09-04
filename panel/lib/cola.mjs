// Pedir un borrador desde el panel.
//
// El generador (generador/generar.py) vive en Pavilion, pero el panel no puede
// lanzarlo: su servicio corre con IPAddressDeny=any y 96 MB, a propósito, por
// ser el proceso siempre en pie y expuesto por NPM. Y el generador necesita
// AniList y animethemes (internet) y unos minutos de Ollama.
//
// Así que el panel sólo ESCRIBE UN PEDIDO en una cola de ficheros, y otra
// unidad de systemd (carlos-opinion-generar.path → .service), con salida a
// internet y sin el límite de memoria, lo recoge, lanza el generador y deja el
// resultado en `hecho/`. El borrador aparece donde siempre: en la rama
// `borradores`, que el panel ya lista.
//
// Puro: aquí se valida el pedido, se traduce a argumentos del generador y se
// interpreta su salida. Ni disco ni procesos. Lo comprueba scripts/test-panel.mjs.

import { ErrorPanel } from './aplicar.mjs';

export const MODOS = ['id', 'titulo', 'jellyfin'];
/** Cuántos borradores como mucho por pedido de «lo nuevo de Jellyfin». */
export const LIMITE_MAXIMO = 10;
export const LIMITE_POR_DEFECTO = 3;
/** Cuántos resultados se conservan en hecho/. */
export const MAX_HECHOS = 20;
/** Cuánto de la salida del generador se guarda (las últimas líneas). */
export const LINEAS_SALIDA = 40;
export const CARACTERES_SALIDA = 4000;

const texto = (v) => String(v ?? '').trim();

/**
 * Valida lo que manda el navegador y devuelve el pedido tal como se guarda en
 * la cola. `id` lo pone el servidor, nunca el cliente: es el nombre del fichero.
 *
 *   { modo: 'id',       seccion, anilistId, tituloEs? }
 *   { modo: 'titulo',   seccion, titulo,    tituloEs? }
 *   { modo: 'jellyfin', limite? }                       (sólo anime)
 */
export function pedido(cuerpo, { claves, id, hoy }) {
  const c = cuerpo ?? {};
  const modo = texto(c.modo);
  if (!MODOS.includes(modo)) {
    throw new ErrorPanel(400, `modo "${modo}" desconocido. Válidos: ${MODOS.join(', ')}.`);
  }
  if (!id) throw new ErrorPanel(500, 'el pedido necesita un id');

  const base = { id, modo, pedido: hoy ?? '' };

  if (modo === 'jellyfin') {
    const limite = c.limite === undefined || c.limite === '' ? LIMITE_POR_DEFECTO : Number(c.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
      throw new ErrorPanel(400, `el límite tiene que ser un entero entre 1 y ${LIMITE_MAXIMO}`);
    }
    return { ...base, seccion: 'anime', limite };
  }

  const seccion = texto(c.seccion);
  if (!claves.includes(seccion)) {
    throw new ErrorPanel(400, `sección "${seccion}" desconocida. Válidas: ${claves.join(', ')}.`);
  }
  const tituloEs = texto(c.tituloEs);
  if (tituloEs.length > 200) throw new ErrorPanel(400, 'el título en español es demasiado largo');

  if (modo === 'id') {
    const anilistId = Number(c.anilistId);
    if (!Number.isInteger(anilistId) || anilistId <= 0) {
      throw new ErrorPanel(400, 'el id de AniList tiene que ser un entero positivo');
    }
    return { ...base, seccion, anilistId, ...(tituloEs ? { tituloEs } : {}) };
  }

  const titulo = texto(c.titulo);
  if (!titulo) throw new ErrorPanel(400, 'falta el título que buscar en AniList');
  if (titulo.length > 200) throw new ErrorPanel(400, 'el título es demasiado largo');
  return { ...base, seccion, titulo, ...(tituloEs ? { tituloEs } : {}) };
}

/**
 * Los argumentos con los que se lanza generar.py. Siempre `--a-borradores`:
 * el resultado va a la rama, nunca a la salida. `anime` es la ruta del
 * anime.json publicado, que sólo hace falta para el modo jellyfin.
 */
export function argumentosDe(trabajo, { anime } = {}) {
  const t = trabajo ?? {};
  if (t.modo === 'jellyfin') {
    if (!anime) throw new Error('el modo jellyfin necesita la ruta del anime.json publicado');
    return ['--pendientes', anime, '--generar', '--limite', String(t.limite ?? LIMITE_POR_DEFECTO)];
  }
  const args = ['--seccion', t.seccion];
  if (t.modo === 'id') args.push('--anilist-id', String(t.anilistId));
  else if (t.modo === 'titulo') args.push('--titulo', t.titulo);
  else throw new Error(`modo desconocido: ${t.modo}`);
  args.push('--a-borradores');
  if (t.tituloEs) args.push('--titulo-es', t.tituloEs);
  return args;
}

const NOMBRES = { anime: 'anime', manga: 'manga', lightnovel: 'novela ligera' };

/** Cómo se llama el pedido en la interfaz y en el aviso. */
export function resumenDe(trabajo) {
  const t = trabajo ?? {};
  if (t.modo === 'jellyfin') return `Lo nuevo de Jellyfin (hasta ${t.limite ?? LIMITE_POR_DEFECTO})`;
  const que = NOMBRES[t.seccion] ?? t.seccion ?? '?';
  if (t.modo === 'id') return `${que} #${t.anilistId}`;
  return `${que} «${t.titulo}»`;
}

/** Las últimas líneas de lo que dijo el generador, acotadas. */
export function recortarSalida(salida) {
  const lineas = String(salida ?? '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  let texto = lineas.slice(-LINEAS_SALIDA).join('\n');
  if (texto.length > CARACTERES_SALIDA) texto = `…${texto.slice(-CARACTERES_SALIDA)}`;
  return texto;
}

/**
 * Cuando se busca por título y AniList devuelve varios, el generador para y
 * los lista («--anilist-id 123  Título  [TV, 2024]»). Se sacan de la salida
 * para que el panel los ofrezca como botones: elegir uno es pedir por id.
 */
export function candidatosDe(salida) {
  const salidaTexto = String(salida ?? '');
  const candidatos = [];
  for (const linea of salidaTexto.split('\n')) {
    const m = linea.match(/--anilist-id\s+(\d+)\s+(.+?)\s*$/);
    if (m) candidatos.push({ anilistId: Number(m[1]), titulo: m[2].trim() });
  }
  return candidatos;
}

/** Lo que se guarda en hecho/ al terminar. */
export function resultadoDe(trabajo, { codigo, salida, empezado, terminado, motivo }) {
  const recortada = recortarSalida(salida);
  const ok = codigo === 0;
  return {
    ...trabajo,
    estado: ok ? 'ok' : 'error',
    codigo: codigo ?? null,
    ...(motivo ? { motivo } : {}),
    salida: recortada,
    candidatos: ok ? [] : candidatosDe(recortada),
    empezado: empezado ?? '',
    terminado: terminado ?? '',
  };
}

/** Los `MAX_HECHOS` más recientes, por fecha de fin. Devuelve los que sobran. */
export function sobrantes(hechos, maximo = MAX_HECHOS) {
  const orden = [...(hechos ?? [])].sort((a, b) => String(b.terminado ?? '').localeCompare(String(a.terminado ?? '')));
  return orden.slice(maximo);
}
