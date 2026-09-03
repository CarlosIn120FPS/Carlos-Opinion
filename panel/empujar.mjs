#!/usr/bin/env node
/**
 * Publica lo que el panel haya escrito. Lo lanza un timer cada 2 minutos.
 *
 * Va aparte del servidor a propósito: empujar dispara el hook, que compila
 * (~60 s en un dv6), y `git receive-pack` es hijo del push. Si esto ocurriera
 * dentro de la petición HTTP, escribir dos frases costaría un minuto.
 *
 * Hace el CICLO COMPLETO, no sólo el push. Si Carlos empujó desde el PC entre
 * medias, un push a secas sale rechazado por non-fast-forward y el contador de
 * pendientes sigue en pie: se reintentaría cada 2 minutos para siempre y en
 * silencio. Con fetch+rebase delante, eso se resuelve solo.
 *
 * Y comprueba que se haya publicado DE VERDAD: git ignora el código de salida de
 * post-receive, así que un build roto da un push con éxito y una web sin
 * actualizar. Ver scripts/deploy.mjs, que hace lo mismo desde el PC.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoGit } from './lib/repo.mjs';
import { localizarRepo } from '../scripts/portadas.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.CO_PANEL_BASE || '/home/carlosalexei/carlos-opinion';
const REMOTO = process.env.CO_PANEL_REMOTO || 'origin';
const NTFY = process.env.CO_PANEL_NTFY || '';

const repo = repoGit(RAIZ);

async function avisar(texto) {
  console.error(texto);
  if (!NTFY) return;
  await fetch(NTFY, { method: 'POST', body: texto }).catch(() => {});
}

// Portadas locales ANTES de mirar si hay algo que empujar: una ficha publicada
// desde el móvil llega con la URL de AniList, y el panel no puede bajarla (su
// servicio no tiene salida a internet a propósito). Este proceso sí. Si no hay
// nada externo, cuesta leer tres JSON y ya. Si la descarga falla, la ficha se
// queda con su URL y se reintenta en el próximo ciclo.
try {
  const { cambiados, informe } = await localizarRepo(RAIZ, { log: console.log });
  if (cambiados.length) {
    const titulos = informe.filter((f) => f.estado === 'ok').map((f) => f.title).join(', ');
    await repo.commitear(`Portadas locales: ${titulos}`, cambiados);
  }
} catch (e) {
  await avisar(`Panel: no se pudieron traer las portadas — ${e.message}`);
}

const pendientes = await repo.pendientes().catch(() => 0);
if (pendientes === 0) process.exit(0);

console.log(`${pendientes} cambio(s) sin publicar`);

// El ciclo completo. Si esto falla, el árbol queda igual y el timer reintenta.
try {
  await repo.sincronizar();
} catch (e) {
  await avisar(`Panel: no se pudo poner al día antes de publicar — ${e.message}`);
  process.exit(1);
}

const cabeza = await repo.cabeza();

let salida = '';
try {
  salida = await repo.empujar(REMOTO);
} catch (e) {
  await avisar(`Panel: el push falló — ${e.message}`);
  process.exit(1);
}

// El hook se cayó pero el push dijo que todo bien. Esto es lo único que lo delata.
const publicada = await readFile(`${BASE}/.deploy-ok`, 'utf8').then((t) => t.trim(), () => '');
if (publicada !== cabeza) {
  let motivo = '';
  try {
    motivo = (await readFile(`${BASE}/.deploy-fail`, 'utf8')).trim();
  } catch { /* sin detalle */ }
  await avisar(
    `Panel: se empujó ${cabeza.slice(0, 7)} pero la web NO se actualizó.` +
      `${motivo ? `\n${motivo}` : ''}\n${salida.trim()}`,
  );
  process.exit(1);
}

console.log(`Publicado ${cabeza.slice(0, 7)}`);
