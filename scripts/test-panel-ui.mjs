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
  append(...cosas) {
    for (const c of cosas) {
      if (c == null) continue;
      if (c instanceof Nodo) c.padre = this;
      this.hijos.push(c);
    }
  }
  replaceChildren(...cosas) { this.hijos = []; this.append(...cosas); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return this.atributos[k]; }
  addEventListener() {}
  get children() { return this.hijos.filter((h) => h instanceof Nodo); }
  // Tiene que desengancharse de verdad. Cuando era un no-op, la lista no se
  // limpiaba entre vistas y el test enseñaba fichas y borradores juntos — un
  // fallo inventado por el stub, que es peor que no tener test.
  remove() {
    if (!this.padre) return;
    this.padre.hijos = this.padre.hijos.filter((h) => h !== this);
    this.padre = null;
  }
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

// Dos borradores: uno completo y uno del respaldo de animethemes, sin géneros —
// que es exactamente el estado de los 28 que hay hoy.
const BORRADORES = [
  { id: '101280', seccion: 'anime', title: 'Tensei shitara Slime Datta Ken',
    japaneseTitle: '転生したらスライムだった件', episodes: '6 temporadas', fuente: 'animethemes',
    falta: ['genres'], revisar: ['episodes'], avisos: [], yaPublicado: false },
  { id: '999002', seccion: 'anime', title: 'Obra completa', japaneseTitle: 'テスト',
    episodes: '1 temporada/12', fuente: 'anilist', falta: [], revisar: [], avisos: [],
    yaPublicado: false },
];
const DETALLE = {
  101280: { title: 'Tensei shitara Slime Datta Ken', japaneseTitle: '転生したらスライムだった件',
    episodes: '6 temporadas', genres: [], hasManga: false, hasLightNovel: false,
    openings: [{ name: 'a' }, { name: 'b' }], endings: [], description: 'DESCRIPCION PROPUESTA' },
  999002: { title: 'Obra completa', japaneseTitle: 'テスト', episodes: '1 temporada/12',
    genres: ['Comedia'], hasManga: true, hasLightNovel: false, openings: [], endings: [] },
};

// Respuesta fija de AniList: la ficha 8 (Alya) con 2 episodios vistos.
const ANILIST = {
  data: {
    MediaListCollection: { lists: [{ entries: [
      { mediaId: 162804, progress: 2, status: 'CURRENT', updatedAt: 1788400000 },
    ] }] },
    Page: { media: [{ id: 162804, format: 'TV', seasonYear: 2024 }] },
  },
};

// Una ficha de manga publicada, para que el selector de hermanas tenga algo que
// ofrecer. Sintética: en manga.json real no se escribe texto de prueba.
const MANGA = { categories: ['Leído'], items: [{ id: 41, title: 'MANGA HERMANO', hasAnime: true }] };

const REVISAR = { anime: { 8: { campos: ['episodes', 'genres'], avisos: ['AVISO DEL GENERADOR'], fuente: 'anilist', fecha: '2026-09-03' } } };

const llamadas = [];
globalThis.fetch = async (ruta, opciones = {}) => {
  llamadas.push({ ruta, metodo: opciones.method ?? 'GET', cabeceras: opciones.headers ?? {}, cuerpo: opciones.body });
  if (String(ruta).includes('graphql.anilist.co')) {
    return { ok: true, status: 200, json: async () => ANILIST };
  }
  if (ruta === '/api/anime/hermana') {
    const { id, seccion, hermanaId } = JSON.parse(opciones.body);
    const ficha = { ...ANIME.items.find((i) => String(i.id) === String(id)) };
    if (hermanaId) ficha.related = { [seccion]: Number(hermanaId) };
    return { ok: true, json: async () => ({ ok: true, ficha }) };
  }
  if (ruta === '/api/manga') return { ok: true, json: async () => MANGA };
  // Lo que propuso la máquina para la ficha 8 y aún no se ha mirado.
  if (ruta === '/api/revisar') return { ok: true, json: async () => REVISAR };
  if (ruta === '/api/anime/revisar/8/hecho') {
    delete REVISAR.anime;
    return { ok: true, json: async () => ({ ok: true, revisar: REVISAR }) };
  }
  const mDetalle = ruta.match(/^\/api\/borradores\/anime\/(\d+)$/);
  if (mDetalle) return { ok: true, json: async () => DETALLE[mDetalle[1]] };
  const cuerpo =
    ruta === '/api/borradores'
      ? { borradores: BORRADORES, categorias: { anime: ANIME.categories, manga: [], lightnovel: [] } }
      : ruta === '/api/secciones'
      ? { modo: 'servidor', anilist: 'carlostest', secciones: [
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
        '/m/pendientes.js': 'panel/lib/pendientes.mjs',
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
// Las pseudo-secciones (borradores, pendientes) llevan clave con __ delante.
const botonesSeccion = secciones.children.filter(
  (b) => b.dataset.clave && !b.dataset.clave.startsWith('__'),
);
igual('pinta las tres secciones en la barra lateral',
  botonesSeccion.map((b) => b.textContent), ['Anime', 'Manga', 'Novelas ligeras']);
check('marca la sección activa',
  secciones.children.some((b) => b.getAttribute('aria-current') === 'true'));
// El fallo original: dataset se asignaba encima y reventaba aquí.
igual('guarda la clave de la sección en dataset',
  botonesSeccion.map((b) => b.dataset.clave), ['anime', 'manga', 'lightnovel']);

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

  // --- lo que propuso la máquina: bloque aparte, y sobrevive a publicar ------
  {
    check('la lista marca la ficha con cosas que revisar',
      conDiario.buscarTodos('.revisar').length === 1, conDiario.textContent);
    const bloque = detalle.querySelector('.revisar');
    check('pinta el bloque de revisar en la ficha', Boolean(bloque));
    const t = bloque?.textContent ?? '';
    check('con los campos marcados y su valor publicado',
      t.includes('episodes') && t.includes(String(ANIME.items[0].episodes)), t.slice(0, 300));
    check('los géneros (array) salen como lista legible',
      t.includes(ANIME.items[0].genres.join(', ')), t.slice(0, 300));
    check('y los avisos del generador', t.includes('AVISO DEL GENERADOR'));
    const boton = bloque?.buscarTodos('button')[0];
    check('hay un botón para marcarlo como revisado', boton?.textContent.includes('revisado'));
    if (boton) {
      await boton.onclick();
      await new Promise((r) => setImmediate(r));
      check('al pulsarlo avisa al servidor',
        llamadas.some((l) => l.ruta === '/api/anime/revisar/8/hecho' && l.metodo === 'POST'));
      check('y el bloque desaparece', !raiz.querySelector('#detalle').querySelector('.revisar'));
      check('y la marca de la lista también',
        raiz.querySelector('#lista').buscarTodos('.pin').every((p) => p.textContent !== 'revisar'));
    }
  }

  // --- fichas hermanas: se eligen de una lista, nunca se adivinan --------------
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const hermanas = detalle.querySelector('#hermanas');
  check('pinta el bloque de fichas hermanas', Boolean(hermanas) && plano.includes('otra sección'));
  const selectores = hermanas?.buscarTodos('select') ?? [];
  // Anime declara dos hermanas: manga y novela ligera.
  igual('un selector por sección hermana', selectores.length, 2);
  const opcionesManga = selectores[0]?.children.map((o) => o.textContent) ?? [];
  igual('el de manga ofrece las fichas publicadas de manga, y «sin ficha»',
    opcionesManga, ['— sin ficha —', 'MANGA HERMANO']);
  check('pide las fichas de manga al servidor para poblarlo',
    llamadas.some((l) => l.ruta === '/api/manga'));

  if (selectores[0]) {
    selectores[0].value = '41';
    await selectores[0].onchange();
    await new Promise((r) => setImmediate(r));
    const enviada = llamadas.find((l) => l.ruta === '/api/anime/hermana');
    check('al elegir, manda el enlace a la ruta de hermanas', Boolean(enviada));
    igual('con la ficha, la sección y el id elegido',
      enviada && JSON.parse(enviada.cuerpo), { id: ANIME.items[0].id, seccion: 'manga', hermanaId: '41' });
    igual('y actualiza la ficha en memoria con lo que devolvió el servidor',
      ANIME.items[0].related, { manga: 41 });
  }
}

// --- los borradores: la mitad del panel que faltaba --------------------------
{
  const botones = secciones.children;
  const bBorradores = botones.find((b) => b.dataset.clave === '__borradores');
  check('hay un botón de borradores en la barra lateral', Boolean(bBorradores));

  if (bBorradores) {
    igual('y dice cuántos hay pendientes', bBorradores.textContent, 'Borradores (2)');

    await bBorradores.onclick();
    await new Promise((r) => setImmediate(r));

    const filasB = raiz.querySelector('#lista').buscarTodos('.fila');
    igual('lista los borradores', filasB.map((f) => f.buscarTodos('.t')[0]?.textContent),
      ['Tensei shitara Slime Datta Ken', 'Obra completa']);
    // Lo importante: avisa de que está incompleto ANTES de pulsar publicar.
    check('marca el que está incompleto',
      filasB[0].buscarTodos('.pendiente').length === 1, filasB[0].textContent);
    check('y no marca el que está completo',
      filasB[1].buscarTodos('.pendiente').length === 0);

    await filasB[0].onclick();
    await new Promise((r) => setImmediate(r));

    const det = raiz.querySelector('#detalle').textContent;
    check('al abrirlo enseña el título', det.includes('Tensei shitara Slime'), det.slice(0, 120));
    check('avisa de que le falta genres', det.includes('genres'), det.slice(0, 400));
    check('dice qué revisar de lo que propuso la máquina',
      det.includes('episodes'), det.slice(0, 400));
    check('enseña lo que ha encontrado la máquina',
      det.includes('Lo que ha encontrado la máquina'), det.slice(0, 300));
    check('y la descripción propuesta',
      det.includes('DESCRIPCION PROPUESTA'), det.slice(0, 500));

    const selects = raiz.querySelector('#detalle').buscarTodos('select');
    igual('hay un selector de categoría', selects.length, 1);
    const opciones = selects[0]?.children.map((o) => o.textContent) ?? [];
    check('con las categorías de anime, no las de manga',
      opciones.includes('Viendo') && opciones.includes('Visto'), JSON.stringify(opciones));
    check('y la primera opción obliga a elegir',
      opciones[0]?.includes('categoría'), JSON.stringify(opciones));
  }
}

// --- la bandeja de pendientes -----------------------------------------------
{
  const bPend = secciones.children.find((b) => b.dataset.clave === '__pendientes');
  check('hay un boton de pendientes cuando hay usuario de AniList', Boolean(bPend));
  if (bPend) {
    await bPend.onclick();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const det = raiz.querySelector('#detalle').textContent;
    check('ensena los pendientes', det.includes('Pendientes de comentar'), det.slice(0, 200));
    check('con la ficha a la que pertenecen', det.includes('Alya'), det.slice(0, 300));
    // AniList dice 2 episodios vistos; la ficha 8 no tiene diario: dos filas.
    check('una fila por episodio visto sin comentar',
      det.includes('Episodio 2') && det.includes('Episodio 1'), det.slice(0, 400));
    // Una sola temporada: no se numera.
    check('con una sola temporada no pone Tn', !det.includes('T1 · Episodio'), det.slice(0, 400));
    check('la fecha solo va en el ultimo visto', det.includes('sin fecha'), det.slice(0, 400));

    // LO QUE NO PUEDE HACER: rellenar la opinion ni la nota.
    const campos = raiz.querySelector('#detalle').buscarTodos('input');
    check('hay campos para escribir', campos.length >= 2, String(campos.length));
    check('pero vienen VACIOS: la voz es suya',
      campos.every((i) => !i.value), JSON.stringify(campos.map((i) => i.value)));

    check('se consulto a AniList de verdad',
      llamadas.some((l) => String(l.ruta).includes('graphql.anilist.co')));
    check('y sin mandarle el token del panel',
      llamadas.filter((l) => String(l.ruta).includes('anilist'))
        .every((l) => !l.cabeceras['X-Panel-Token']));
  }
}

// -------------------------------------------------------------------- resultado
console.log(`\n  ${pasan} comprobaciones de la interfaz pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
