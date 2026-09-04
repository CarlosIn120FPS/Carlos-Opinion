#!/usr/bin/env node
/**
 * Recoge los pedidos de borrador que deja el panel y lanza el generador.
 *
 * Lo dispara carlos-opinion-generar.path cuando aparece algo en la cola. Va
 * aparte del escritor del panel a propósito: ese servicio no tiene salida a
 * internet ni memoria para esto (ver deploy/panel/carlos-opinion-panel.service),
 * y el generador tarda minutos (AniList, animethemes, Ollama, verificar enlaces).
 *
 *   ~/carlos-opinion/generar/cola/<id>.json      lo que pide el panel
 *   ~/carlos-opinion/generar/enmarcha/<id>.json  lo que se está generando
 *   ~/carlos-opinion/generar/hecho/<id>.json     el resultado (ok / error + salida)
 *
 * LA REGLA QUE IMPIDE EL BUCLE: cada fichero de la cola se MUEVE a enmarcha/
 * antes de hacer nada con él, pase lo que pase después. La unidad .path
 * vuelve a disparar el servicio mientras la cola no esté vacía; si un pedido
 * roto se quedara en la cola, esto correría sin parar.
 *
 * Y si el proceso muere a medias (corte de luz, OOM), lo que quede en enmarcha/
 * pasa a hecho/ como «interrumpido» al arrancar la siguiente vez. Nunca se
 * relanza solo: Carlos lo vuelve a pedir si quiere.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, writeFile, rename, unlink, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { argumentosDe, resumenDe, resultadoDe, sobrantes } from './lib/cola.mjs';

const ejecutar = promisify(execFile);

const BASE = process.env.CO_PANEL_BASE || '/home/carlosalexei/carlos-opinion';
const RAIZ_COLA = process.env.CO_PANEL_GENERAR || `${BASE}/generar`;
const COLA = join(RAIZ_COLA, 'cola');
const ENMARCHA = join(RAIZ_COLA, 'enmarcha');
const HECHO = join(RAIZ_COLA, 'hecho');
// El generador en Pavilion es una copia a mano, no un checkout (deploy/README.md).
const GENERADOR = process.env.CO_GENERADOR || `${BASE}/generador/generador/generar.py`;
const PYTHON = process.env.CO_PYTHON || 'python3';
const REPO_BARE = process.env.CO_REPO || `${BASE}/repo.git`;
const NTFY = process.env.CO_PANEL_NTFY || '';
// Un anime con Ollama y verificación de enlaces son unos minutos; «lo nuevo de
// Jellyfin» son varios seguidos. Con esto no se cuelga para siempre y no se
// mata a nada a medias por un tropiezo de red.
const TIEMPO_MAXIMO_MS = Number(process.env.CO_GENERAR_TIMEOUT_MS) || 45 * 60 * 1000;

const ahora = () => new Date().toISOString();

async function avisar(titulo, texto) {
  console.log(`${titulo}: ${texto}`);
  if (!NTFY) return;
  await fetch(NTFY, { method: 'POST', headers: { Title: titulo }, body: texto }).catch(() => {});
}

async function escribirHecho(resultado) {
  await mkdir(HECHO, { recursive: true });
  const tmp = join(HECHO, `.${resultado.id}.tmp`);
  await writeFile(tmp, `${JSON.stringify(resultado, null, 2)}\n`, 'utf8');
  await rename(tmp, join(HECHO, `${resultado.id}.json`));
}

async function leerJson(ruta) {
  return JSON.parse(await readFile(ruta, 'utf8'));
}

/** Los ficheros .json de un directorio, del más antiguo al más nuevo. */
async function pedidosEn(dir) {
  const nombres = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.json')).sort();
  return nombres.map((n) => join(dir, n));
}

/**
 * Los datos PUBLICADOS, sacados del bare sin tocar ningún árbol de trabajo.
 * Los tres ficheros, no sólo anime.json: `--pendientes` busca manga.json y
 * lightnovels.json al lado del anime.json que se le da, y si no están, calla y
 * no avisa de las fichas hermanas. Devuelve la ruta del anime.json.
 */
async function datosPublicados(dirTemporal) {
  let anime = '';
  for (const fichero of ['anime.json', 'manga.json', 'lightnovels.json']) {
    const { stdout } = await ejecutar('git', ['--git-dir', REPO_BARE, 'show', `main:public/data/${fichero}`], {
      encoding: 'utf8', maxBuffer: 20e6,
    });
    const ruta = join(dirTemporal, fichero);
    await writeFile(ruta, stdout, 'utf8');
    if (fichero === 'anime.json') anime = ruta;
  }
  return anime;
}

async function generar(trabajo) {
  const dirTemporal = await mkdtemp(join(tmpdir(), 'co-generar-'));
  const empezado = ahora();
  let codigo = null;
  let salida = '';
  let motivo = '';
  try {
    const anime = trabajo.modo === 'jellyfin' ? await datosPublicados(dirTemporal) : undefined;
    const args = [GENERADOR, ...argumentosDe(trabajo, { anime })];
    console.log(`Generando ${resumenDe(trabajo)}: ${PYTHON} ${args.join(' ')}`);
    try {
      const r = await ejecutar(PYTHON, args, {
        cwd: dirname(GENERADOR),
        env: { ...process.env, CO_BASE: BASE, PYTHONUNBUFFERED: '1' },
        encoding: 'utf8',
        maxBuffer: 20e6,
        timeout: TIEMPO_MAXIMO_MS,
        killSignal: 'SIGTERM',
      });
      codigo = 0;
      salida = `${r.stdout}\n${r.stderr}`;
    } catch (e) {
      // execFile rechaza con la salida dentro: se conserva, es lo que explica el fallo.
      codigo = typeof e.code === 'number' ? e.code : 1;
      salida = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
      if (e.killed || e.signal) {
        const tope = TIEMPO_MAXIMO_MS >= 60000 ? `${Math.round(TIEMPO_MAXIMO_MS / 60000)} min` : `${Math.round(TIEMPO_MAXIMO_MS / 1000)} s`;
        motivo = `el generador tardó más de ${tope} y se paró`;
      } else if (!e.stdout && !e.stderr) {
        motivo = e.message;
      }
    }
  } catch (e) {
    codigo = 1;
    motivo = e.message;
  } finally {
    await rm(dirTemporal, { recursive: true, force: true }).catch(() => {});
  }
  return resultadoDe(trabajo, { codigo, salida, empezado, terminado: ahora(), motivo });
}

async function podar() {
  const hechos = [];
  for (const ruta of await pedidosEn(HECHO)) {
    const h = await leerJson(ruta).catch(() => null);
    hechos.push({ ruta, terminado: h?.terminado ?? '' });
  }
  for (const viejo of sobrantes(hechos)) await unlink(viejo.ruta).catch(() => {});
}

// --------------------------------------------------------------------- main
await mkdir(COLA, { recursive: true });
await mkdir(ENMARCHA, { recursive: true });
await mkdir(HECHO, { recursive: true });

// Lo que quedó a medias de una ejecución anterior: se da por interrumpido.
for (const ruta of await pedidosEn(ENMARCHA)) {
  const trabajo = await leerJson(ruta).catch(() => ({ id: basename(ruta, '.json'), modo: '?' }));
  await escribirHecho(resultadoDe(trabajo, {
    codigo: 1, salida: '', empezado: '', terminado: ahora(),
    motivo: 'se interrumpió antes de terminar (¿reinicio?); pídelo otra vez si lo quieres',
  }));
  await unlink(ruta).catch(() => {});
}

let hechos = 0;
for (;;) {
  const [siguiente] = await pedidosEn(COLA);
  if (!siguiente) break;

  // PRIMERO fuera de la cola. Después, lo que sea.
  const enMarcha = join(ENMARCHA, basename(siguiente));
  await rename(siguiente, enMarcha);

  const trabajo = await leerJson(enMarcha).catch(() => null);
  if (!trabajo || !trabajo.id) {
    await escribirHecho(resultadoDe({ id: basename(siguiente, '.json'), modo: '?' }, {
      codigo: 1, salida: '', terminado: ahora(), motivo: 'el pedido no se pudo leer',
    }));
    await unlink(enMarcha).catch(() => {});
    continue;
  }

  const resultado = await generar(trabajo);
  await escribirHecho(resultado);
  await unlink(enMarcha).catch(() => {});
  hechos += 1;

  const que = resumenDe(trabajo);
  if (resultado.estado === 'ok' && resultado.generados === 0) {
    await avisar('Nada nuevo en Jellyfin', 'Todo lo de la biblioteca ya está publicado o en borradores.');
  } else if (resultado.estado === 'ok') {
    await avisar('Borrador listo', `${que}. Ya está en el panel, en Borradores.`);
  } else if (resultado.candidatos.length) {
    await avisar('Borrador: hay que elegir', `${que}: AniList devuelve ${resultado.candidatos.length} resultados. Elige uno en el panel.`);
  } else {
    await avisar('Borrador fallido', `${que}: ${resultado.motivo || resultado.salida.split('\n').slice(-2).join(' ') || 'sin detalle'}`);
  }
}

await podar();
console.log(`${hechos} pedido(s) atendido(s)`);
