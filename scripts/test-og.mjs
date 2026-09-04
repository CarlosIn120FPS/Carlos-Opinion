#!/usr/bin/env node
/**
 * Comprueba las vistas previas (Open Graph): node scripts/test-og.mjs
 *
 * Puro contra scripts/lib/og.mjs (vistas previas, sitemap, feed, robots), y
 * luego el generador entero sobre un dist temporal con datos sintéticos y los
 * tipos REALES de contentTypes.js.
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  escapar, absoluta, recortar, metasDe, inyectar, rutaSalida,
  enlazarFeed, fechaDe, fichasDe, sitemap, feed, fechaRss, robots,
} from './lib/og.mjs';
import { cargarTipos, generar } from './og.mjs';

let pasan = 0;
const fallos = [];
const check = (n, cond, d = '') => { if (cond) pasan += 1; else fallos.push(`${n}${d ? ` — ${d}` : ''}`); };
const igual = (n, real, esp) =>
  check(n, JSON.stringify(real) === JSON.stringify(esp),
    `esperaba ${JSON.stringify(esp)}, obtuve ${JSON.stringify(real)}`);

const TIPO = { slug: 'anime', file: 'anime.json', pageTitle: "Carlos' Opinion", pageDescription: 'Opiniones de Carlos.' };
const SITIO = 'https://opinion.example';

// ------------------------------------------------------------------ piezas
igual('escapar: comillas, & y <>', escapar('a "b" & <c>'), 'a &quot;b&quot; &amp; &lt;c&gt;');
igual('absoluta: sitio + ruta', absoluta(SITIO, '/', 'covers/anime-8.webp'), `${SITIO}/covers/anime-8.webp`);
igual('absoluta: con base de GitHub Pages', absoluta(SITIO, '/Carlos-Opinion/', 'anime/2'), `${SITIO}/Carlos-Opinion/anime/2`);
igual('absoluta: sin dobles barras', absoluta(`${SITIO}/`, '/', '/anime'), `${SITIO}/anime`);
igual('absoluta: una URL externa se respeta', absoluta(SITIO, '/', 'https://cdn.x/a.jpg'), 'https://cdn.x/a.jpg');
igual('absoluta: vacío da vacío', absoluta(SITIO, '/', ''), '');
igual('recortar: corto se queda igual', recortar('hola  mundo'), 'hola mundo');
{
  const largo = 'palabra '.repeat(60).trim();
  const r = recortar(largo, 50);
  check('recortar: no pasa del largo y acaba en puntos suspensivos', r.length <= 51 && r.endsWith('…'), r);
  check('recortar: no parte una palabra', !r.includes('palabr…'), r);
}

// ---------------------------------------------------------------- metas
{
  const item = { id: 2, title: 'Call of the Night', description: 'Un chaval que no duerme.', image: 'covers/anime-2.jpg' };
  const m = metasDe({ tipo: TIPO, item, sitio: SITIO });
  igual('ficha: título con el de la web detrás', m.title, "Call of the Night · Carlos' Opinion");
  igual('ficha: la descripción es la suya', m.description, 'Un chaval que no duerme.');
  igual('ficha: url absoluta a la ficha', m.url, `${SITIO}/anime/2`);
  igual('ficha: la portada local se vuelve absoluta', m.image, `${SITIO}/covers/anime-2.jpg`);
  igual('ficha: type article', m.type, 'article');
  const sinDesc = metasDe({ tipo: TIPO, item: { ...item, description: '' }, sitio: SITIO });
  igual('ficha sin descripción: la de la sección', sinDesc.description, 'Opiniones de Carlos.');
  const s = metasDe({ tipo: TIPO, sitio: SITIO });
  igual('sección: título de la sección', s.title, "Carlos' Opinion");
  igual('sección: url de la sección', s.url, `${SITIO}/anime`);
  igual('sección: sin imagen', s.image, '');
  igual('rutaSalida ficha', rutaSalida(TIPO, item), 'anime/2.html');
  igual('rutaSalida sección', rutaSalida(TIPO), 'anime.html');
}

// ------------------------------------------------------------- inyectar
const PLANTILLA = `<!doctype html><html lang="es"><head><meta charset="UTF-8" />
<title>Carlos' Opinion</title>
<meta name="description" content="generica" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Carlos' Opinion" />
<meta property="og:description" content="generica" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="alternate" type="application/rss+xml" title="Carlos' Opinion" href="/feed.xml" />
<script type="module" src="/assets/index-abc.js"></script></head><body><div id="root"></div></body></html>`;
{
  const item = { id: 3, title: 'Rascal "Bunny" & <Senpai>', description: 'Desc', image: 'covers/anime-3.webp' };
  const html = inyectar(PLANTILLA, metasDe({ tipo: TIPO, item, sitio: SITIO }));
  check('inyectar: title escapado', html.includes(`<title>Rascal &quot;Bunny&quot; &amp; &lt;Senpai&gt; · Carlos' Opinion</title>`), html.slice(0, 200));
  check('inyectar: og:title', html.includes('property="og:title" content="Rascal &quot;Bunny&quot; &amp; &lt;Senpai&gt; · Carlos\' Opinion"'));
  check('inyectar: og:image absoluta', html.includes(`property="og:image" content="${SITIO}/covers/anime-3.webp"`));
  check('inyectar: twitter:image', html.includes(`name="twitter:image" content="${SITIO}/covers/anime-3.webp"`));
  check('inyectar: og:url', html.includes(`property="og:url" content="${SITIO}/anime/3"`));
  check('inyectar: canonical', html.includes(`rel="canonical" href="${SITIO}/anime/3"`));
  check('inyectar: og:type article', html.includes('property="og:type" content="article"'));
  check('inyectar: el bundle sigue ahí', html.includes('/assets/index-abc.js') && html.includes('<div id="root">'));
  igual('inyectar: una sola etiqueta de cada', (html.match(/property="og:title"/g) ?? []).length, 1);
  igual('inyectar: no queda la descripción genérica', (html.match(/content="generica"/g) ?? []).length, 0);

  const seccion = inyectar(PLANTILLA, metasDe({ tipo: TIPO, sitio: SITIO }));
  check('sección sin imagen: twitter:card summary y sin og:image',
    seccion.includes('name="twitter:card" content="summary"') && !seccion.includes('og:image'));
}

// ------------------------------------------------ sitemap, feed y robots
{
  const MANGA = { slug: 'manga', file: 'manga.json', pageTitle: "Carlos' Manga Opinion", pageDescription: 'Mangas.' };
  const conDiario = { id: 1, title: 'A & B', description: 'desc', entries: [
    { date: '2026-09-01', episode: 1 }, { date: '2026-09-03', episode: 2 }, { episode: 3 }, { date: 'ayer' },
  ] };
  const sinDiario = { id: 5, title: 'Sin diario', description: 'nada', personalOpinion: 'Mi "opinión" <cruda>' };
  const manga = { id: 2, title: 'M', spanishTitle: 'Eme', description: 'm', category: 'Leído', entries: [{ date: '2026-09-02' }] };
  const secciones = [[TIPO, { items: [sinDiario, conDiario] }], [MANGA, { items: [manga] }]];

  igual('fechaDe: la última fecha válida del diario', fechaDe(conDiario), '2026-09-03');
  igual('fechaDe: sin diario, sin fecha (no se inventa)', fechaDe(sinDiario), '');
  igual('fechaDe: fechas que no lo son se ignoran', fechaDe({ entries: [{ date: 'ayer' }] }), '');
  igual('fichasDe: con fecha primero (la más reciente arriba), luego por id de mayor a menor',
    fichasDe(secciones, { sitio: SITIO }).map((f) => f.url),
    [`${SITIO}/anime/1`, `${SITIO}/manga/2`, `${SITIO}/anime/5`]);

  const sm = sitemap(secciones, { sitio: SITIO });
  check('sitemap: portada, secciones y fichas',
    sm.includes(`<loc>${SITIO}/</loc>`) && sm.includes(`<loc>${SITIO}/anime</loc>`)
    && sm.includes(`<loc>${SITIO}/manga</loc>`) && sm.includes(`<loc>${SITIO}/manga/2</loc>`), sm);
  check('sitemap: lastmod sólo donde hay fecha',
    sm.includes(`<loc>${SITIO}/anime/1</loc><lastmod>2026-09-03</lastmod>`)
    && /anime\/5<\/loc><\/url>/.test(sm), sm);
  igual('sitemap: una url por página', (sm.match(/<url>/g) ?? []).length, 6);
  check('sitemap: xml bien formado por fuera', sm.startsWith('<?xml') && sm.trim().endsWith('</urlset>'));

  const rss = feed(secciones, { sitio: SITIO, titulo: "Carlos' Opinion", descripcion: 'Opiniones & más' });
  check('feed: cabecera del canal escapada',
    rss.includes("<title>Carlos' Opinion</title>") && rss.includes('<description>Opiniones &amp; más</description>'), rss.slice(0, 400));
  check('feed: enlace a sí mismo', rss.includes(`href="${SITIO}/feed.xml" rel="self"`));
  check('feed: el título de la ficha va escapado y con la sección',
    rss.includes("<title>A &amp; B · Carlos' Opinion</title>"), rss);
  check('feed: el título en español acompaña al de AniList', rss.includes("<title>M (Eme) · Carlos' Manga Opinion</title>"), rss);
  check('feed: la opinión publicada es la descripción, escapada',
    rss.includes('<description>Mi &quot;opinión&quot; &lt;cruda&gt;</description>'), rss);
  check('feed: guid permanente = url de la ficha',
    rss.includes(`<guid isPermaLink="true">${SITIO}/anime/1</guid>`), rss);
  check('feed: pubDate RFC 822 sólo con fecha',
    rss.includes('<pubDate>Thu, 03 Sep 2026 12:00:00 GMT</pubDate>') && (rss.match(/<pubDate>/g) ?? []).length === 2, rss);
  check('feed: la categoría de Carlos va como category', rss.includes('<category>Leído</category>'));
  igual('feed: un item por ficha', (rss.match(/<item>/g) ?? []).length, 3);
  igual('feed: maximo recorta', (feed(secciones, { sitio: SITIO, maximo: 2 }).match(/<item>/g) ?? []).length, 2);
  igual('fechaRss: formato RSS', fechaRss('2026-01-05'), 'Mon, 05 Jan 2026 12:00:00 GMT');
  igual('fechaRss: vacío si no hay fecha', fechaRss(''), '');

  igual('robots: abierto y con el sitemap', robots({ sitio: SITIO }),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITIO}/sitemap.xml\n`);
  check('robots: con base, el sitemap cuelga de la base',
    robots({ sitio: SITIO, base: '/Carlos-Opinion/' }).includes(`Sitemap: ${SITIO}/Carlos-Opinion/sitemap.xml`));

  const conFeed = enlazarFeed(PLANTILLA, `${SITIO}/x/feed.xml`);
  check('enlazarFeed: vuelve absoluto el enlace del feed', conFeed.includes(`href="${SITIO}/x/feed.xml"`) && !conFeed.includes('href="/feed.xml"'));
  igual('enlazarFeed: sin enlace, no toca nada', enlazarFeed('<head></head>', 'x'), '<head></head>');
  const ficha = inyectar(PLANTILLA, metasDe({ tipo: TIPO, item: conDiario, sitio: SITIO, base: '/b/' }));
  check('inyectar: las páginas por ficha llevan el feed absoluto', ficha.includes(`href="${SITIO}/b/feed.xml"`), ficha);
}

// -------------------------------------- el generador, con los tipos reales
{
  const tipos = await cargarTipos();
  igual('carga los tres tipos reales sin React', tipos.map((t) => t.slug), ['anime', 'manga', 'novelas']);
  check('con sus textos', tipos.every((t) => t.pageTitle && t.pageDescription && t.file));

  const dist = mkdtempSync(join(tmpdir(), 'co-og-'));
  writeFileSync(join(dist, 'index.html'), PLANTILLA);
  const datos = {
    'anime.json': { items: [{ id: 1, title: 'A', description: 'a', image: 'covers/anime-1.jpg' }, { id: 2, title: 'B', description: '', image: '' }] },
    'manga.json': { items: [{ id: 1, title: 'M', description: 'm', image: 'https://cdn.x/m.jpg' }] },
    'lightnovels.json': { items: [] },
  };
  try {
    const escritas = await generar({ dist, sitio: SITIO, tipos, leerDatos: async (f) => datos[f] });
    igual('una página por sección y por ficha, más sitemap, feed y robots',
      escritas, ['anime.html', 'anime/1.html', 'anime/2.html', 'manga.html', 'manga/1.html', 'novelas.html',
        'sitemap.xml', 'feed.xml', 'robots.txt']);
    const sm = readFileSync(resolve(dist, 'sitemap.xml'), 'utf8');
    check('el sitemap lista las tres secciones reales y las fichas',
      sm.includes(`<loc>${SITIO}/novelas</loc>`) && sm.includes(`<loc>${SITIO}/manga/1</loc>`), sm);
    const rss = readFileSync(resolve(dist, 'feed.xml'), 'utf8');
    check('el feed lleva el título real de la web y las fichas',
      rss.includes("<title>Carlos' Opinion</title>") && rss.includes(`${SITIO}/anime/1</guid>`), rss.slice(0, 300));
    check('el index.html enlaza el feed absoluto',
      readFileSync(resolve(dist, 'index.html'), 'utf8').includes(`href="${SITIO}/feed.xml"`));
    check('los ficheros existen', escritas.every((r) => existsSync(resolve(dist, r))));
    const a1 = readFileSync(resolve(dist, 'anime/1.html'), 'utf8');
    check('la ficha lleva su portada', a1.includes(`content="${SITIO}/covers/anime-1.jpg"`));
    const m1 = readFileSync(resolve(dist, 'manga/1.html'), 'utf8');
    check('una portada externa se deja tal cual', m1.includes('content="https://cdn.x/m.jpg"'));
    const n = readFileSync(resolve(dist, 'novelas.html'), 'utf8');
    check('la sección de novelas lleva su url', n.includes(`content="${SITIO}/novelas"`));
    // Con base de GitHub Pages, todo cuelga de /Carlos-Opinion/.
    await generar({ dist, base: '/Carlos-Opinion/', sitio: SITIO, tipos, leerDatos: async (f) => datos[f] });
    const p = readFileSync(resolve(dist, 'anime/1.html'), 'utf8');
    check('con --base, url e imagen cuelgan de la base',
      p.includes(`content="${SITIO}/Carlos-Opinion/anime/1"`) && p.includes(`content="${SITIO}/Carlos-Opinion/covers/anime-1.jpg"`), p.slice(0, 400));
    check('con --base, el index.html enlaza el feed absoluto',
      readFileSync(resolve(dist, 'index.html'), 'utf8').includes(`href="${SITIO}/Carlos-Opinion/feed.xml"`));
    check('con --base, robots apunta al sitemap de la base',
      readFileSync(resolve(dist, 'robots.txt'), 'utf8').includes(`${SITIO}/Carlos-Opinion/sitemap.xml`));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log(`\n  ${pasan} comprobaciones de vistas previas pasan, ${fallos.length} fallan\n`);
if (fallos.length) {
  for (const f of fallos) console.error(`    FALLA: ${f}`);
  console.error('');
  process.exit(1);
}
