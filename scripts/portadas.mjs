#!/usr/bin/env node
/**
 * Trae a public/covers/ las portadas que aún cuelgan de CDNs ajenos y reescribe
 * `image` en los JSON para que apunten al fichero propio.
 *
 *   npm run portadas            baja lo que falte y reescribe
 *   npm run portadas -- --seco  sólo dice qué haría
 *
 * Lo ejecuta también panel/empujar.mjs en Pavilion antes de publicar, para que
 * una ficha publicada desde el móvil no se quede con la URL de AniList. El panel
 * no puede hacerlo al publicar: su servicio no tiene salida a internet a
 * propósito (IPAddressDeny=any). El que empuja sí.
 *
 * La lógica vive en panel/lib/portadas.mjs; aquí sólo hay red y disco.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECCIONES, CLAVES, seccion } from '../panel/lib/secciones.mjs';
import { serializar } from '../panel/lib/aplicar.mjs';
import { localizar, FalloPermanente, CARPETA, FICHERO_ORIGEN, TAMANO_MAX } from '../panel/lib/portadas.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function descargar(url) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 25000);
  let r;
  try {
    r = await fetch(url, {
      signal: control.signal,
      redirect: 'follow',
      headers: {
        // Crunchyroll sirve format=auto y elige según Accept: sin esto puede
        // devolver AVIF, que ni el detector ni todos los navegadores entienden.
        Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; carlos-opinion-portadas/1.0)',
      },
    });
  } finally {
    clearTimeout(reloj);
  }
  if ([400, 401, 403, 404, 410].includes(r.status)) throw new FalloPermanente(`HTTP ${r.status}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const largo = Number(r.headers.get('content-length') || 0);
  if (largo > TAMANO_MAX) throw new FalloPermanente(`content-length ${largo}, más de ${TAMANO_MAX}`);
  return new Uint8Array(await r.arrayBuffer());
}

// La portada de la misma obra en AniList, para cuando la URL de la ficha ha
// muerto. Es la fuente de la que salen las fichas nuevas; aquí sólo se usa como
// sustituta. Sin anilistIds no hay nada que preguntar.
async function portadaEnAniList({ clave, anilistIds }) {
  const id = anilistIds?.[0];
  if (!id) return null;
  const tipo = clave === 'anime' ? 'ANIME' : 'MANGA';
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: 'query ($id: Int, $tipo: MediaType) { Media(id: $id, type: $tipo) { coverImage { extraLarge large } } }',
      variables: { id, tipo },
    }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const c = j?.data?.Media?.coverImage;
  return c?.extraLarge || c?.large || null;
}

/**
 * Hace el trabajo sobre el repositorio en `raiz`. Devuelve los ficheros que ha
 * cambiado (rutas relativas), para que quien llame pueda commitearlos.
 */
export async function localizarRepo(raiz, { seco = false, log = () => {}, hoy } = {}) {
  const datosPorClave = {};
  for (const clave of CLAVES) {
    datosPorClave[clave] = JSON.parse(await readFile(resolve(raiz, SECCIONES[clave].fichero), 'utf8'));
  }
  const origen = await readFile(resolve(raiz, FICHERO_ORIGEN), 'utf8').then(JSON.parse, () => ({}));

  const escritos = [];
  const escribir = async (nombre, bytes) => {
    if (seco) return;
    await mkdir(resolve(raiz, CARPETA), { recursive: true });
    await writeFile(resolve(raiz, CARPETA, nombre), bytes);
    escritos.push(`${CARPETA}/${nombre}`);
  };

  const r = await localizar({
    datosPorClave, origen, descargar, escribir, alternativa: portadaEnAniList,
    hoy: hoy ?? new Date().toISOString().slice(0, 10),
  });

  for (const f of r.informe) {
    const marca = f.estado === 'ok' ? 'OK ' : f.estado === 'fallo' ? 'NO ' : '...';
    log(`  ${marca} ${f.clave}/${f.id} «${f.title}»: ${f.detalle}`);
  }
  if (!r.informe.length) log('  Ninguna portada externa pendiente.');

  const cambiados = [...escritos];
  if (!seco) {
    for (const [clave, datos] of Object.entries(r.datosPorClave)) {
      const fichero = seccion(clave).fichero;
      const texto = serializar(datos);
      JSON.parse(texto); // reparseo antes de tocar el fichero de Carlos
      await writeFile(resolve(raiz, fichero), texto, 'utf8');
      cambiados.push(fichero);
    }
    if (r.informe.length) {
      await mkdir(resolve(raiz, CARPETA), { recursive: true });
      await writeFile(resolve(raiz, FICHERO_ORIGEN), `${JSON.stringify(r.origen, null, 2)}\n`, 'utf8');
      cambiados.push(FICHERO_ORIGEN);
    }
  }
  return { cambiados, informe: r.informe };
}

// Sólo cuando se ejecuta directamente, no cuando lo importa empujar.mjs.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const seco = process.argv.includes('--seco');
  console.log(`\n  Portadas locales${seco ? ' (en seco, no se escribe nada)' : ''}\n`);
  const { cambiados, informe } = await localizarRepo(RAIZ, { seco, log: console.log });
  const ok = informe.filter((f) => f.estado === 'ok').length;
  const mal = informe.length - ok;
  console.log(`\n  ${ok} bajada${ok === 1 ? '' : 's'}, ${mal} sin bajar` +
    (cambiados.length ? `. Cambiados: ${cambiados.length} ficheros (revísalos con git diff).` : '.') + '\n');
}
