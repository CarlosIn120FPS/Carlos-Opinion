#!/usr/bin/env node
/**
 * El panel privado — etapa 1, modo local:  npm run panel
 *
 * Sirve una interfaz en http://127.0.0.1:8099 para rellenar los campos que sólo
 * escribe Carlos y para ir dejando el diario mientras ve o lee algo.
 *
 * Etapa 1 escribe en el árbol de trabajo y nada más. Publicar sigue siendo
 * `npm run deploy`, que ya comprueba de verdad que la web se ha actualizado.
 * Separado a propósito: el panel no hace commits a tus espaldas.
 *
 * Sin dependencias: http de node y ficheros estáticos. El navegador importa
 * src/lib/entries.js y src/data/niveles.js tal cual —son ESM sin imports— así que
 * el agrupado del diario que se ve aquí es LITERALMENTE el mismo código que pinta
 * la web pública. No hay dos verdades que se puedan desincronizar.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir, copyFile, readdir, unlink } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { aplicar, serializar, ErrorPanel } from './lib/aplicar.mjs';
import { SECCIONES, CLAVES, seccion } from './lib/secciones.mjs';
import { repoGit } from './lib/repo.mjs';
import { promover, loQueFalta } from './lib/promover.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(RAIZ, 'panel/web');
const COPIAS = resolve(RAIZ, 'panel/.copias');
const PUERTO = Number(process.env.CO_PANEL_PUERTO || 8099);

// Escucha explícita. En node, listen(puerto) a secas abre en :: / 0.0.0.0, y el
// criterio del nodo (deploy/docker-compose.yml:15) es no abrir nunca en 0.0.0.0.
// En local ni siquiera sale de la máquina.
const MODO = process.env.CO_PANEL_MODO || 'local';
const DIRECCION = MODO === 'local' ? '127.0.0.1' : process.env.CO_PANEL_IP;

// En modo servidor esto edita la web desde fuera de casa: arrancar sin token o
// escuchando en todas las interfaces sería justo lo que no se puede hacer, así
// que se muere aquí en vez de arrancar mal.
const TOKEN = process.env.CO_PANEL_TOKEN || '';
if (MODO === 'servidor') {
  if (!DIRECCION || DIRECCION === '0.0.0.0' || DIRECCION === '::') {
    console.error('  CO_PANEL_IP tiene que ser la IP de LAN. Nunca 0.0.0.0.');
    process.exit(1);
  }
  if (TOKEN.length < 24) {
    console.error('  CO_PANEL_TOKEN ausente o demasiado corto (mínimo 24 caracteres).');
    process.exit(1);
  }
}

// En modo servidor el panel es otro cliente de git: commitea lo que escribe. En
// local escribe en el árbol de trabajo y ya; Carlos commitea cuando quiere.
//
// `git` existe en los dos modos, porque los borradores del generador se leen de
// la rama `borradores` también en local (allí el remoto se llama "casa").
const git = repoGit(RAIZ);
const repo = MODO === 'servidor' ? git : null;
const REMOTO = process.env.CO_PANEL_REMOTO || (MODO === 'servidor' ? 'origin' : 'casa');

// Los tres módulos que el navegador comparte con la web pública. Allowlist
// literal: si se sirviera un directorio raíz, dentro está .git/ — con el
// historial entero y, en modo servidor, credenciales.
const MODULOS = new Map([
  ['/m/entries.js', 'src/lib/entries.js'],
  ['/m/niveles.js', 'src/data/niveles.js'],
  ['/m/rating.js', 'src/lib/rating.js'],
  ['/m/pendientes.js', 'panel/lib/pendientes.mjs'],
]);

// El usuario de AniList, para la bandeja de pendientes. Vive en panel.env, no en
// el repositorio: es publico y un nombre de usuario es un dato personal. Si no
// esta puesto, la bandeja no aparece — no es un error, es que no se usa.
const ANILIST_USUARIO = process.env.CO_ANILIST_USUARIO || '';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const enviar = (res, codigo, cuerpo, tipo = 'application/json; charset=utf-8') => {
  res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
  res.end(cuerpo);
};
const json = (res, codigo, obj) => enviar(res, codigo, JSON.stringify(obj));

// Un cambio cada vez. El servidor es de un solo usuario, pero dos pestañas
// abiertas bastan para pisarse: leer-modificar-escribir no es atómico.
let cola = Promise.resolve();
const enSerie = (fn) => {
  const siguiente = cola.then(fn, fn);
  cola = siguiente.catch(() => {});
  return siguiente;
};

const leerSeccion = async (clave) =>
  JSON.parse(await readFile(resolve(RAIZ, seccion(clave).fichero), 'utf8'));

/**
 * Escritura atómica con anillo de copias. Escribe a .tmp y renombra: si esto se
 * corta a la mitad, no queda un anime.json roto. Y antes guarda una copia, que
 * son los datos que no se pueden regenerar de ninguna fuente.
 */
async function guardarSeccion(clave, datos) {
  const destino = resolve(RAIZ, seccion(clave).fichero);
  const texto = serializar(datos);

  // Reparseo antes de tocar nada: si lo que vamos a escribir no es JSON válido,
  // mejor enterarse aquí que dejar la web sin datos.
  JSON.parse(texto);

  await mkdir(COPIAS, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  await copyFile(destino, join(COPIAS, `${clave}-${sello}.json`)).catch(() => {});

  // El anillo: nos quedamos con las 20 últimas de cada sección.
  const previas = (await readdir(COPIAS).catch(() => []))
    .filter((f) => f.startsWith(`${clave}-`))
    .sort();
  for (const vieja of previas.slice(0, -20)) await unlink(join(COPIAS, vieja)).catch(() => {});

  const tmp = `${destino}.tmp`;
  await writeFile(tmp, texto, 'utf8');
  await rename(tmp, destino);
}

const cuerpoDe = (req) =>
  new Promise((cumplir, fallar) => {
    let datos = '';
    req.on('data', (trozo) => {
      datos += trozo;
      if (datos.length > 1e6) fallar(new ErrorPanel(400, 'petición demasiado grande'));
    });
    req.on('end', () => {
      try {
        cumplir(datos ? JSON.parse(datos) : {});
      } catch {
        fallar(new ErrorPanel(400, 'el cuerpo no es JSON válido'));
      }
    });
    req.on('error', fallar);
  });

async function estatico(res, ruta) {
  // Ruta relativa a panel/web, resuelta y comprobada: nada de ../../
  const limpia = ruta === '/' ? '/index.html' : ruta;
  const destino = resolve(WEB, `.${limpia}`);
  if (!destino.startsWith(WEB)) return json(res, 403, { error: 'fuera de sitio' });
  try {
    if (destino.endsWith('index.html')) {
      // El token viaja dentro de la página: si has llegado hasta aquí es que ya
      // pasaste la Access List de NPM. No es una segunda contraseña, es lo que
      // impide que otra web haga peticiones a ésta desde tu navegador.
      // replaceAll y no replace: con una cadena, replace sustituye SÓLO la
      // primera aparición. Un comentario que nombrase el marcador se llevaría la
      // sustitución y el <meta> se quedaría sin token — que es justo lo que pasó.
      const html = await readFile(destino, 'utf8');
      return enviar(res, 200, html.replaceAll('__TOKEN__', TOKEN), TIPOS['.html']);
    }
    const cuerpo = await readFile(destino);
    enviar(res, 200, cuerpo, TIPOS[extname(destino)] ?? 'application/octet-stream');
  } catch {
    json(res, 404, { error: 'no existe' });
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const ruta = url.pathname;

  try {
    // --- los módulos que se comparten con la web pública ---------------------
    if (MODULOS.has(ruta)) {
      const cuerpo = await readFile(resolve(RAIZ, MODULOS.get(ruta)), 'utf8');
      return enviar(res, 200, cuerpo, TIPOS['.js']);
    }

    // --- API -----------------------------------------------------------------
    // Cabecera propia, NO `Authorization: Bearer`. La Access List de NPM usa
    // auth_basic: el navegador ya tiene cacheado un `Authorization: Basic` para
    // este origen, y mandar un Bearer encima haría que nginx viera un
    // Authorization que no es Basic y devolviera 401 sin llegar hasta aquí.
    if (ruta.startsWith('/api/') && TOKEN && req.headers['x-panel-token'] !== TOKEN) {
      return json(res, 401, { error: 'falta el token del panel; recarga la página' });
    }

    if (ruta === '/api/secciones' && req.method === 'GET') {
      return json(res, 200, {
        modo: MODO,
        anilist: ANILIST_USUARIO,
        secciones: CLAVES.map((c) => ({
          clave: c,
          etiqueta: SECCIONES[c].etiqueta,
          campos: SECCIONES[c].campos,
        })),
      });
    }

    // Antes que la ruta de sección: /api/estado también encaja en /^\/api\/(\w+)$/
    // y acabaría buscando una sección llamada "estado".
    if (ruta === '/api/estado' && req.method === 'GET') {
      return json(res, 200, { modo: MODO, pendientes: repo ? await repo.pendientes() : 0 });
    }

    // --- los borradores que va dejando el generador --------------------------
    // Esto es la otra mitad del panel: sin ella, las fichas que la máquina deja
    // a medias sólo se veían con `git show` desde el PC.
    if (ruta === '/api/borradores' && req.method === 'GET') {
      const categorias = {};
      const lista = await enSerie(async () => {
        await git.traerBorradores(REMOTO);
        const salida = [];
        for (const clave of CLAVES) {
          const s = seccion(clave);
          const datos = await leerSeccion(clave).catch(() => ({ items: [] }));
          // Cada sección tiene las suyas ("Visto/Viendo" en anime, "Leído" en
          // manga), y el borrador puede no ser de la sección que esté abierta.
          categorias[clave] = datos.categories ?? [];
          const publicados = new Set(
            (datos.items ?? []).flatMap((i) => i.anilistIds ?? []),
          );
          for (const id of await git.listarBorradores(REMOTO, s.drafts)) {
            const b = await git.leerBorrador(REMOTO, s.drafts, id).catch(() => null);
            if (!b) continue;
            const ids = b._meta?.anilistIds ?? [];
            salida.push({
              id,
              seccion: clave,
              title: b.title ?? '(sin título)',
              japaneseTitle: b.japaneseTitle ?? '',
              episodes: b.episodes ?? '',
              fuente: b._meta?.fuente ?? '?',
              // Lo que le falta para poder publicarse, dicho ANTES de que pulse
              // el botón en vez de después.
              falta: loQueFalta(b),
              revisar: b._meta?._revisar ?? [],
              avisos: b._meta?._avisos ?? [],
              yaPublicado: ids.some((x) => publicados.has(x)),
            });
          }
        }
        return salida;
      });
      return json(res, 200, { borradores: lista, categorias });
    }

    const mBorrador = ruta.match(/^\/api\/borradores\/([a-z]+)\/([\w-]+)$/);
    if (mBorrador && req.method === 'GET') {
      const [, clave, id] = mBorrador;
      if (!CLAVES.includes(clave)) return json(res, 404, { error: 'sección desconocida' });
      const b = await git.leerBorrador(REMOTO, seccion(clave).drafts, id)
        .catch(() => null);
      if (!b) return json(res, 404, { error: `no hay borrador ${id} en ${clave}` });
      return json(res, 200, b);
    }

    const mPromo = ruta.match(/^\/api\/borradores\/([a-z]+)\/([\w-]+)\/promocionar$/);
    if (mPromo && req.method === 'POST') {
      const [, clave, id] = mPromo;
      if (!CLAVES.includes(clave)) return json(res, 404, { error: 'sección desconocida' });
      const { categoria } = await cuerpoDe(req);
      const resultado = await enSerie(async () => {
        if (repo) await repo.sincronizar();
        await git.traerBorradores(REMOTO);
        const borrador = await git.leerBorrador(REMOTO, seccion(clave).drafts, id);
        const datos = await leerSeccion(clave);
        const { datos: nuevos, ficha, revisar } = promover(datos, borrador, { categoria, clave });
        await guardarSeccion(clave, nuevos);
        if (repo) {
          await repo.commitear(`Panel: publicar «${ficha.title}» (${categoria})`, [seccion(clave).fichero]);
        }
        return { ficha, revisar };
      });
      return json(res, 200, { ok: true, ...resultado });
    }

    // Una sección que no existe es un 404 con su motivo, no un 500 sin explicar:
    // `seccion()` lanza un Error normal a propósito (es un fallo de programación,
    // no del cliente), así que aquí se comprueba antes de llamarla.
    const mRuta = ruta.match(/^\/api\/([a-z]+)(\/op)?$/);
    if (mRuta && !CLAVES.includes(mRuta[1])) {
      return json(res, 404, {
        error: `sección "${mRuta[1]}" desconocida. Válidas: ${CLAVES.join(', ')}.`,
      });
    }

    const mSeccion = ruta.match(/^\/api\/([a-z]+)$/);
    if (mSeccion && req.method === 'GET') {
      // Ponerse al día antes de leer: si no, Carlos promociona un borrador desde
      // el PC y en el móvil no aparece. Datos rancios es lo que hace que se deje
      // de usar una herramienta.
      const datos = await enSerie(async () => {
        if (repo) await repo.sincronizar();
        return leerSeccion(mSeccion[1]);
      });
      return json(res, 200, datos);
    }

    const mOp = ruta.match(/^\/api\/([a-z]+)\/op$/);
    if (mOp && req.method === 'POST') {
      const clave = mOp[1];
      const op = await cuerpoDe(req);
      const resultado = await enSerie(async () => {
        if (repo) await repo.sincronizar();
        const datos = await leerSeccion(clave);
        const { datos: nuevos, ficha } = aplicar(datos, op, clave, {
          hoy: new Date().toISOString().slice(0, 10),
          nuevoId: `e-${randomUUID().slice(0, 8)}`,
        });
        await guardarSeccion(clave, nuevos);
        // Se commitea aquí y se devuelve el 200. El push lo hace el timer: si
        // fuese aquí, escribir dos frases costaría el minuto que tarda el build.
        if (repo) {
          await repo.commitear(`Panel: ${op.op} en «${ficha.title}»`, [seccion(clave).fichero]);
        }
        return ficha;
      });
      return json(res, 200, { ok: true, ficha: resultado, pendiente: Boolean(repo) });
    }

    if (ruta.startsWith('/api/')) return json(res, 404, { error: 'ruta desconocida' });

    // --- la interfaz ---------------------------------------------------------
    return await estatico(res, ruta);
  } catch (e) {
    if (e instanceof ErrorPanel) return json(res, e.codigo, { error: e.message });
    console.error(e);
    return json(res, 500, { error: e.message });
  }
});

// Al arrancar, dejar el árbol utilizable: puede que el proceso anterior muriese
// entre escribir y commitear y haya quedado una modificación suelta.
if (repo) {
  const limpiado = await repo.sanear();
  if (limpiado) console.warn('  AVISO: había un cambio a medias sin commitear; se ha descartado.');
}

servidor.listen(PUERTO, DIRECCION, () => {
  if (MODO === 'servidor') {
    console.log(`Panel escuchando en http://${DIRECCION}:${PUERTO} (empuja el timer)`);
    return;
  }
  console.log(`
  Panel privado (modo ${MODO})

      http://${DIRECCION}:${PUERTO}

  Escribe directamente en public/data/*.json. Cuando quieras publicarlo:

      npm run deploy

  Copias de seguridad automáticas en panel/.copias/ (las 20 últimas).
`);
});
