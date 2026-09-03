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

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(RAIZ, 'panel/web');
const COPIAS = resolve(RAIZ, 'panel/.copias');
const PUERTO = Number(process.env.CO_PANEL_PUERTO || 8099);

// Escucha explícita. En node, listen(puerto) a secas abre en :: / 0.0.0.0, y el
// criterio del nodo (deploy/docker-compose.yml:15) es no abrir nunca en 0.0.0.0.
// En local ni siquiera sale de la máquina.
const MODO = process.env.CO_PANEL_MODO || 'local';
const DIRECCION = MODO === 'local' ? '127.0.0.1' : (process.env.CO_PANEL_IP || '127.0.0.1');

// Los tres módulos que el navegador comparte con la web pública. Allowlist
// literal: si se sirviera un directorio raíz, dentro está .git/ — con el
// historial entero y, en modo servidor, credenciales.
const MODULOS = new Map([
  ['/m/entries.js', 'src/lib/entries.js'],
  ['/m/niveles.js', 'src/data/niveles.js'],
  ['/m/rating.js', 'src/lib/rating.js'],
]);

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
    if (ruta === '/api/secciones' && req.method === 'GET') {
      return json(res, 200, {
        modo: MODO,
        secciones: CLAVES.map((c) => ({
          clave: c,
          etiqueta: SECCIONES[c].etiqueta,
          campos: SECCIONES[c].campos,
        })),
      });
    }

    const mSeccion = ruta.match(/^\/api\/([a-z]+)$/);
    if (mSeccion && req.method === 'GET') {
      const datos = await leerSeccion(mSeccion[1]);
      return json(res, 200, datos);
    }

    const mOp = ruta.match(/^\/api\/([a-z]+)\/op$/);
    if (mOp && req.method === 'POST') {
      const clave = mOp[1];
      const op = await cuerpoDe(req);
      const resultado = await enSerie(async () => {
        const datos = await leerSeccion(clave);
        const { datos: nuevos, ficha } = aplicar(datos, op, clave, {
          hoy: new Date().toISOString().slice(0, 10),
          nuevoId: `e-${randomUUID().slice(0, 8)}`,
        });
        await guardarSeccion(clave, nuevos);
        return ficha;
      });
      return json(res, 200, { ok: true, ficha: resultado });
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

servidor.listen(PUERTO, DIRECCION, () => {
  console.log(`
  Panel privado (modo ${MODO})

      http://${DIRECCION}:${PUERTO}

  Escribe directamente en public/data/*.json. Cuando quieras publicarlo:

      npm run deploy

  Copias de seguridad automáticas en panel/.copias/ (las 20 últimas).
`);
});
