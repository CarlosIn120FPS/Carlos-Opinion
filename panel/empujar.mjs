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
 *
 * Y al final, haya o no algo que publicar, RESPALDA en GitHub lo publicado
 * (origin/main → github/v2). Sin eso, lo escrito desde el móvil sólo existía en
 * Pavilion hasta que Carlos lo traía al PC. Ver panel/lib/respaldo.mjs.
 */

import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoGit } from './lib/repo.mjs';
import { decidirRespaldo, anotarFallo, leerFallo } from './lib/respaldo.mjs';
import { localizarRepo } from '../scripts/portadas.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.CO_PANEL_BASE || '/home/carlosalexei/carlos-opinion';
const REMOTO = process.env.CO_PANEL_REMOTO || 'origin';
const NTFY = process.env.CO_PANEL_NTFY || '';
// La copia: remoto `github` del clon (con su clave de despliegue en
// core.sshCommand) y rama v2, que es donde vive el trabajo en GitHub.
const GITHUB = process.env.CO_PANEL_GITHUB ?? 'github';
const GITHUB_RAMA = process.env.CO_PANEL_GITHUB_RAMA || 'v2';
const FICHERO_FALLO = `${BASE}/.github-fallo`;

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

/**
 * La copia en GitHub de lo publicado. Nunca de HEAD: si el push de arriba
 * falló, HEAD lleva commits que la web no tiene. Sin cambios no hay red; tras
 * un fallo se espera unas horas (la clave sin registrar, GitHub caído) para no
 * avisar cada dos minutos.
 */
async function respaldar() {
  if (!GITHUB || !(await repo.tieneRemoto(GITHUB))) return;
  await repo.traerPublicado().catch(() => {});
  const publicado = await repo.revDe('origin/main');
  const respaldado = await repo.revDe(`${GITHUB}/${GITHUB_RAMA}`);
  const fallo = leerFallo(await readFile(FICHERO_FALLO, 'utf8').catch(() => ''));
  const decision = decidirRespaldo({ publicado, respaldado, fallo, ahora: Date.now() });
  if (!decision.empujar) {
    if (decision.motivo !== 'al día') console.log(`GitHub: ${decision.motivo}`);
    return;
  }
  try {
    await repo.empujarA(GITHUB, 'origin/main', GITHUB_RAMA);
    await unlink(FICHERO_FALLO).catch(() => {});
    console.log(`GitHub: ${GITHUB_RAMA} al día en ${publicado.slice(0, 7)}`);
  } catch (e) {
    const motivo = (e.stderr || e.message || '').trim().split('\n').slice(-3).join(' ');
    await writeFile(FICHERO_FALLO, JSON.stringify(anotarFallo(publicado, Date.now(), motivo)), 'utf8').catch(() => {});
    const pista = /publickey|permission denied/i.test(motivo)
      ? '\nFalta registrar la clave de Pavilion en GitHub (deploy/panel/README.md).'
      : '';
    await avisar(
      `Panel: la copia en GitHub no se pudo hacer (${publicado.slice(0, 7)}). Se reintenta en unas horas.${pista}\n${motivo}`,
    );
  }
}

const pendientes = await repo.pendientes().catch(() => 0);
if (pendientes === 0) {
  await respaldar();
  process.exit(0);
}

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
await respaldar();
