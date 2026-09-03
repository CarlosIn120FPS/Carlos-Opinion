#!/usr/bin/env node
/**
 * Arranca la interfaz del panel de verdad: node scripts/test-panel-ui.mjs
 *
 * Existe por un fallo concreto: se envió un panel que servía el HTML y el JS
 * perfectamente —curl daba 200 en todo— pero que al abrirlo en un navegador
 * moría en la primera línea con «Cannot set property dataset ... which has only
 * a getter». Comprobar que un fichero se sirve NO es comprobar que funciona.
 *
 * Aquí se monta un DOM mínimo, se ejecuta panel.js y se mira lo que pinta. El
 * `dataset` del stub es de SÓLO LECTURA a propósito: si no, no reproduciría el
 * fallo que motivó todo esto.
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let pasan = 0;
const fallos = [];
const check = (n, cond, d = '') => { if (cond) pasan += 1; else fallos.push(`${n}${d ? ` — ${d}` : ''}`); };
const igual = (n, real, esp) =>
  check(n, JSON.stringify(real) === JSON.stringify(esp),
    `esperaba ${JSON.stringify(esp)}, obtuve ${JSON.stringify(real)}`);

// ----------------------------------------------------------------- DOM mínimo
class Nodo {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.hijos = [];
    this.atributos = {};
    this._dataset = {};
    this._texto = '';
    this.className = '';
  }
  // Sólo getter, igual que en un navegador de verdad. Asignarle encima tiene que
  // reventar: es el fallo que esta prueba existe para cazar.
  get dataset() { return this._dataset; }
  get textContent() {
    return this._texto || this.hijos.map((h) => (typeof h === 'string' ? h : h.textContent)).join('');
  }
  set textContent(v) { this._texto = String(v); this.hijos = []; }
  append(...cosas) { for (const c of cosas) if (c != null) this.hijos.push(c); }
  replaceChildren(...cosas) { this.hijos = []; this.append(...cosas); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return this.atributos[k]; }
  addEventListener() {}
  get children() { return this.hijos.filter((h) => h instanceof Nodo); }
  remove() {}
  // Búsqueda simple: por id (#x) o por clase (.x), recursiva.
  querySelector(sel) { return this.buscarTodos(sel)[0] ?? null; }
  buscarTodos(sel) {
    const salida = [];
    const encaja = (n) =>
      sel.startsWith('#') ? n.id === sel.slice(1)
        : sel.startsWith('.') ? String(n.className).split(/\s+/).includes(sel.slice(1))
          : n.tagName === sel.toUpperCase();
    const recorrer = (n) => {
      for (const h of n.children) { if (encaja(h)) salida.push(h); recorrer(h); }
    };
    recorrer(this);
    return salida;
  }
  texto() { return this.textContent; }
}

const raiz = new Nodo('body');
for (const id of ['app', 'modo', 'secciones', 'estado', 'lista', 'buscador', 'detalle', 'aviso']) {
  const n = new Nodo(id === 'buscador' ? 'input' : 'div');
  n.id = id;
  n.style = {};
  raiz.append(n);
}
// panel.js lee el token de un <meta>; se lo damos.
const meta = new Nodo('meta');
meta.content = 'token-de-prueba';
meta.id = '__meta_token';

globalThis.document = {
  createElement: (t) => new Nodo(t),
  querySelector: (sel) => (sel.startsWith('meta[') ? meta : raiz.querySelector(sel)),
  querySelectorAll: (sel) => raiz.buscarTodos(sel.replace(/^#secciones\s+/, '')),
};
globalThis.setInterval = () => 0;
globalThis.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };
globalThis.clearTimeout = () => {};

// ------------------------------------------------------------- API simulada
const ANIME = JSON.parse(readFileSync(resolve(RAIZ, 'public/data/anime.json'), 'utf8'));
// Una ficha con diario, que es lo que más código toca al pintar.
ANIME.items[0] = { ...ANIME.items[0], entries: [
  { id: 'e1', date: '2026-09-01', season: 1, episode: 1, rating: 8, text: 'PRIMERA' },
  { id: 'e2', date: '2026-09-02', season: 2, episode: 4, text: 'SEGUNDA' },
] };

const llamadas = [];
globalThis.fetch = async (ruta, opciones = {}) => {
  llamadas.push({ ruta, metodo: opciones.method ?? 'GET', cabeceras: opciones.headers ?? {} });
  const cuerpo =
    ruta === '/api/secciones'
      ? { modo: 'servidor', secciones: [
          { clave: 'anime', etiqueta: 'Anime', campos: [
            { clave: 'category', tipo: 'categoria', etiqueta: 'Categoría' },
            { clave: 'rating', tipo: 'texto', etiqueta: 'Nota' },
            { clave: 'personalOpinion', tipo: 'parrafo', etiqueta: 'Opinión' }] },
          { clave: 'manga', etiqueta: 'Manga', campos: [] },
          { clave: 'lightnovel', etiqueta: 'Novelas ligeras', campos: [] },
        ] }
      : ruta === '/api/estado' ? { modo: 'servidor', pendientes: 2 }
        : ruta.startsWith('/api/anime') ? ANIME
          : { categories: [], items: [] };
  return { ok: true, json: async () => cuerpo };
};

// ------------------------------------------------------- compilar y arrancar
const cache = resolve(RAIZ, 'node_modules/.cache/co-render');
mkdirSync(cache, { recursive: true });
const salida = join(cache, 'panel-ui.mjs');
await build({
  entryPoints: [resolve(RAIZ, 'panel/web/panel.js')],
  outfile: salida,
  bundle: true,
  format: 'esm',
  platform: 'node',
  // En el navegador los sirve el servidor bajo /m/; aquí hay que mandarlos al
  // fichero real. `alias` de esbuild no admite nombres que empiecen por "/",
  // así que se resuelve con un plugin.
  plugins: [{
    name: 'modulos-del-panel',
    setup(b) {
      const MAPA = {
        '/m/entries.js': 'src/lib/entries.js',
        '/m/niveles.js': 'src/data/niveles.js',
        '/m/rating.js': 'src/lib/rating.js',
      };
      b.onResolve({ filter: /^\/m\// }, (args) => {
        const destino = MAPA[args.path];
        if (!destino) throw new Error(`el panel importa ${args.path}, que el servidor no sirve`);
        return { path: resolve(RAIZ, destino) };
      });
    },
  }],
  logLevel: 'silent',
});

let arranque = null;
try {
  await import(pathToFileURL(salida).href);
  await new Promise((r) => process.nextTick(r));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
} catch (e) {
  arranque = e;
}

// ------------------------------------------------------------------ lo que se mira
const aviso = raiz.querySelector('#aviso');
check('la página arranca sin reventar', arranque === null, arranque?.message);
check('y no deja un aviso de error', !aviso.textContent.includes('No se pudo arrancar'),
  aviso.textContent);

const secciones = raiz.querySelector('#secciones');
igual('pinta las tres secciones en la barra lateral',
  secciones.children.map((b) => b.textContent), ['Anime', 'Manga', 'Novelas ligeras']);
check('marca la sección activa',
  secciones.children.some((b) => b.getAttribute('aria-current') === 'true'));
// El fallo original: dataset se asignaba encima y reventaba aquí.
igual('guarda la clave de la sección en dataset',
  secciones.children.map((b) => b.dataset.clave), ['anime', 'manga', 'lightnovel']);

const lista = raiz.querySelector('#lista');
const filas = lista.buscarTodos('.fila');
igual('la lista trae todas las fichas', filas.length, ANIME.items.length);
check('la fila enseña la nota cuando la hay',
  filas.some((f) => f.buscarTodos('.nota').length > 0));
check('y marca las que están sin opinar',
  filas.some((f) => f.buscarTodos('.pendiente').length > 0));
check('y cuenta el diario', filas.some((f) => f.buscarTodos('.diario').length > 0));

igual('dice cuánto falta por publicarse',
  raiz.querySelector('#estado').textContent, '2 cambios · se publica en ~2 min');

check('manda el token en todas las peticiones',
  llamadas.length > 0 && llamadas.every((l) => l.cabeceras['X-Panel-Token'] === 'token-de-prueba'),
  JSON.stringify(llamadas.map((l) => l.ruta)));

// --- abrir una ficha: es donde vive el resto del código -----------------------
const conDiario = filas.find((f) => f.buscarTodos('.diario').length > 0);
check('hay una ficha con diario para abrir', Boolean(conDiario));
if (conDiario) {
  conDiario.onclick();
  const detalle = raiz.querySelector('#detalle');
  const plano = detalle.textContent;
  check('al abrirla pinta el título', plano.includes(ANIME.items[0].title), plano.slice(0, 120));
  check('pinta los campos que escribe Carlos', plano.includes('Opinión'), plano.slice(0, 200));
  check('pinta el diario', plano.includes('Diario de visionado'), plano.slice(0, 200));
  check('y sus entradas', plano.includes('PRIMERA') && plano.includes('SEGUNDA'), plano);
  check('agrupa por temporada', plano.includes('Temporada 1') && plano.includes('Temporada 2'), plano);
  check('enseña la nota de la entrada', plano.includes('8/10'), plano);
  const inputs = detalle.buscarTodos('input');
  check('el formulario de nueva entrada tiene sus niveles', inputs.length >= 3, `${inputs.length}`);
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones de la interfaz pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
