#!/usr/bin/env node
/**
 * Publica y COMPRUEBA que se ha publicado:  npm run deploy
 *
 * Por qué hace falta un script para algo que era `git push casa main`:
 *
 *   git IGNORA el código de salida de un hook post-receive.
 *
 * Comprobado ejecutándolo, no razonándolo: con un hook que hace `exit 1`, el
 * push termina con EXIT CODE 0 y la ref queda actualizada en el bare. O sea que
 * si el build falla, `git push casa main` dice que todo ha ido bien y la web
 * sigue sirviendo la versión anterior, en silencio. El texto de error sí sale
 * por pantalla, pero nada que automatice el push puede enterarse — y el panel
 * privado va a automatizarlo.
 *
 * El hook deja `.deploy-ok` con la revisión realmente publicada (después del
 * rsync, no antes) y `.deploy-fail` si se cayó. Esto compara.
 */

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REMOTO = process.env.CO_REMOTO || 'casa';
const RAMA = 'main';
const BASE = 'carlos-opinion';

const git = (...args) =>
  execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

const morir = (msg) => {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
};

// El host ssh sale del propio remoto (pavilion:carlos-opinion/repo.git), para no
// tener el nombre escrito en dos sitios que se puedan desincronizar.
const url = git('remote', 'get-url', REMOTO);
const host = url.includes(':') && !url.startsWith('/') ? url.split(':')[0] : null;

const sucio = git('status', '--porcelain');
if (sucio) morir(`hay cambios sin commitear:\n\n${sucio}`);

const rama = git('rev-parse', '--abbrev-ref', 'HEAD');
if (rama !== RAMA) morir(`estás en "${rama}", no en ${RAMA}. Sólo se publica ${RAMA}.`);

const head = git('rev-parse', 'HEAD');
console.log(`\n  Publicando ${head.slice(0, 7)} en ${REMOTO}...\n`);

try {
  // El hook escribe por stderr; se enseña tal cual para no esconder nada.
  execFileSync('git', ['push', REMOTO, RAMA], { cwd: RAIZ, stdio: 'inherit' });
} catch {
  morir('el push falló. La ref ni siquiera llegó al servidor.');
}

if (!host) {
  console.log('  Remoto local: no se puede verificar por ssh. Lee la salida de arriba.\n');
  process.exit(0);
}

// --- la comprobación de verdad ---------------------------------------------
let publicada = '';
try {
  publicada = execFileSync(
    'ssh',
    [host, `cat ~/${BASE}/.deploy-ok 2>/dev/null || true`],
    { encoding: 'utf8' },
  ).trim();
} catch {
  console.log(`  AVISO: no se pudo consultar ${host} por ssh para verificar.`);
  console.log('  El push salió bien, pero no se ha confirmado que se publicara.\n');
  process.exit(0);
}

if (publicada === head) {
  console.log(`\n  Verificado: ${head.slice(0, 7)} está publicado.\n`);
  process.exit(0);
}

// Si no coincide, el hook se cayó — aunque el push dijera que todo bien.
let motivo = '';
try {
  motivo = execFileSync(
    'ssh',
    [host, `cat ~/${BASE}/.deploy-fail 2>/dev/null || true`],
    { encoding: 'utf8' },
  ).trim();
} catch {
  /* si no se puede leer, el mensaje de abajo ya dice lo esencial */
}

console.error(`
  ==========================================================
   EL PUSH SALIÓ BIEN PERO LA WEB NO SE HA ACTUALIZADO
  ==========================================================

  Empujado:  ${head.slice(0, 7)}
  Publicado: ${publicada ? publicada.slice(0, 7) : '(nada, no hay .deploy-ok)'}
${motivo ? `\n  El servidor dice:\n    ${motivo.split('\n').join('\n    ')}\n` : ''}
  La web sigue sirviendo la versión anterior. Para ver el error entero:
      ssh ${host} 'cd ~/${BASE}/build && npm run build'
`);
process.exit(1);
