// Vistas previas al compartir: un HTML por ficha con sus propias etiquetas
// Open Graph.
//
// La web es un SPA estático: nginx devuelve el mismo index.html para /anime/2
// que para /manga/1, y WhatsApp, Telegram o Discord no ejecutan JavaScript. Así
// que compartir cualquier ficha enseñaba el título genérico y ningún dibujo.
//
// Tras `vite build`, scripts/og.mjs escribe dist/<slug>/<id>.html: el MISMO
// index.html compilado (mismo bundle, misma app) con <title>, description, og:*
// y twitter:* de esa ficha. nginx lo sirve con `try_files $uri $uri.html ...` y
// para el navegador no cambia nada: la app arranca igual y lee la ruta.
//
// La web sigue siendo estática. Sin servidor que renderice, sin nada que caduque.
//
// Puro: sin disco. Lo que lee y escribe ficheros es scripts/og.mjs.

export const SITIO_POR_DEFECTO = 'https://opinion.carlosin120fps.duckdns.org';
const LARGO_DESCRIPCION = 200;

export const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Une sitio + base + ruta sin dobles barras. Una URL absoluta se respeta. */
export function absoluta(sitio, base, ruta) {
  if (!ruta) return '';
  if (/^(https?:)?\/\//i.test(ruta)) return ruta;
  const raiz = String(sitio).replace(/\/+$/, '');
  const b = `/${String(base ?? '/').replace(/^\/+|\/+$/g, '')}`;
  const r = String(ruta).replace(/^\/+/, '');
  return `${raiz}${b === '/' ? '' : b}/${r}`;
}

/** Recorta una descripción a un tamaño de tarjeta, sin partir palabras. */
export function recortar(texto, largo = LARGO_DESCRIPCION) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= largo) return t;
  const corte = t.lastIndexOf(' ', largo - 1);
  return `${t.slice(0, corte > largo / 2 ? corte : largo - 1).trimEnd()}…`;
}

/**
 * Las etiquetas de una página: la de una sección (item = null) o la de una
 * ficha. `tipo` es una entrada de CONTENT_TYPES (slug, pageTitle,
 * pageDescription).
 */
export function metasDe({ tipo, item = null, sitio = SITIO_POR_DEFECTO, base = '/' }) {
  const feed = absoluta(sitio, base, 'feed.xml');
  if (!item) {
    return {
      title: tipo.pageTitle,
      description: recortar(tipo.pageDescription),
      url: absoluta(sitio, base, tipo.slug),
      image: '',
      type: 'website',
      feed,
    };
  }
  return {
    title: `${item.title} · ${tipo.pageTitle}`,
    description: recortar(item.description || tipo.pageDescription),
    url: absoluta(sitio, base, `${tipo.slug}/${item.id}`),
    image: absoluta(sitio, base, item.image),
    type: 'article',
    feed,
  };
}

/** Dónde va cada página dentro de dist/. */
export const rutaSalida = (tipo, item = null) =>
  item ? `${tipo.slug}/${item.id}.html` : `${tipo.slug}.html`;

/**
 * Reescribe en el index.html compilado el <title>, la description y las
 * etiquetas og:/twitter: existentes, y añade og:url y las de imagen. Todo lo
 * demás (bundle, estilos, root) queda intacto: es la misma app.
 */
export function inyectar(html, m) {
  const t = escapar(m.title);
  const d = escapar(m.description);
  let salida = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`)
    .replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${m.type}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`)
    .replace(/<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}" />`);

  const extra = [`<meta property="og:url" content="${escapar(m.url)}" />`];
  if (m.image) {
    extra.push(
      `<meta property="og:image" content="${escapar(m.image)}" />`,
      `<meta name="twitter:image" content="${escapar(m.image)}" />`,
    );
  }
  extra.push(`<link rel="canonical" href="${escapar(m.url)}" />`);
  salida = salida.replace('</head>', `${extra.join('')}</head>`);
  if (m.feed) salida = enlazarFeed(salida, m.feed);
  return salida;
}

/**
 * El index.html lleva `<link rel="alternate" ... href="/feed.xml">`. Aquí se
 * vuelve absoluto (con la base que toque: el dominio propio o GitHub Pages).
 * Sustituye lo que haya, sea lo que sea: así se puede pasar dos veces.
 */
export const enlazarFeed = (html, urlFeed) =>
  html.replace(/(<link\s+rel="alternate"[^>]*href=")[^"]*(")/, `$1${escapar(urlFeed)}$2`);

// ------------------------------------------------------------ sitemap y feed
// Lo que hace que un buscador indexe las fichas y que alguien pueda seguir la
// web sin visitarla. Salen del mismo build que las páginas por ficha.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La fecha de una ficha: la última del diario. Las fichas no llevan fecha de
 * alta, y no se inventa: sin diario, sin fecha (sin lastmod, sin pubDate).
 * Irá llenándose sola según Carlos escriba.
 */
export function fechaDe(item) {
  const fechas = (item?.entries ?? [])
    .map((e) => String(e?.date ?? ''))
    .filter((d) => FECHA.test(d));
  return fechas.length ? fechas.sort().at(-1) : '';
}

/**
 * Las fichas de todas las secciones, listas para el feed y el sitemap: con
 * fecha las primeras (la más reciente arriba), después el resto por id de
 * mayor a menor (lo último que se dio de alta). `secciones` es [[tipo, datos]].
 */
export function fichasDe(secciones, { sitio = SITIO_POR_DEFECTO, base = '/' } = {}) {
  const salida = [];
  for (const [tipo, datos] of secciones) {
    for (const item of datos?.items ?? []) {
      if (item?.id === undefined || item?.id === null || !item.title) continue;
      salida.push({
        tipo,
        item,
        url: absoluta(sitio, base, `${tipo.slug}/${item.id}`),
        fecha: fechaDe(item),
      });
    }
  }
  return salida.sort((a, b) =>
    (b.fecha || '').localeCompare(a.fecha || '') || Number(b.item.id) - Number(a.item.id));
}

const etiqueta = (nombre, valor) => (valor ? `<${nombre}>${escapar(valor)}</${nombre}>` : '');

/** sitemap.xml: la portada, cada sección y cada ficha. */
export function sitemap(secciones, { sitio = SITIO_POR_DEFECTO, base = '/' } = {}) {
  const urls = [{ loc: absoluta(sitio, base, '/'), fecha: '' }];
  for (const [tipo] of secciones) urls.push({ loc: absoluta(sitio, base, tipo.slug), fecha: '' });
  for (const f of fichasDe(secciones, { sitio, base })) urls.push({ loc: f.url, fecha: f.fecha });
  const cuerpo = urls
    .map((u) => `  <url>${etiqueta('loc', u.loc)}${etiqueta('lastmod', u.fecha)}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${cuerpo}\n</urlset>\n`;
}

/** Una fecha YYYY-MM-DD en el formato que exige RSS (RFC 822). */
export const fechaRss = (fecha) =>
  FECHA.test(fecha) ? new Date(`${fecha}T12:00:00Z`).toUTCString() : '';

/**
 * feed.xml (RSS 2.0): una entrada por ficha, con su opinión si la hay. La
 * opinión es la que ya está publicada en la web: aquí no se escribe nada.
 */
export function feed(secciones, { sitio = SITIO_POR_DEFECTO, base = '/', titulo, descripcion, maximo = 50 } = {}) {
  const portada = absoluta(sitio, base, '/');
  const propio = absoluta(sitio, base, 'feed.xml');
  const items = fichasDe(secciones, { sitio, base }).slice(0, maximo).map((f) => {
    const { item, tipo } = f;
    const nombre = item.spanishTitle && item.spanishTitle !== item.title
      ? `${item.title} (${item.spanishTitle})` : item.title;
    const texto = recortar(item.personalOpinion || item.description || tipo.pageDescription, 400);
    return '  <item>'
      + etiqueta('title', `${nombre} · ${tipo.pageTitle}`)
      + etiqueta('link', f.url)
      + `<guid isPermaLink="true">${escapar(f.url)}</guid>`
      + etiqueta('description', texto)
      + (item.category ? etiqueta('category', item.category) : '')
      + etiqueta('pubDate', fechaRss(f.fecha))
      + '</item>';
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n`
    + `  ${etiqueta('title', titulo)}\n  ${etiqueta('link', portada)}\n  ${etiqueta('description', descripcion)}\n`
    + `  <language>es</language>\n`
    + `  <atom:link href="${escapar(propio)}" rel="self" type="application/rss+xml" />\n`
    + `${items.join('\n')}\n</channel>\n</rss>\n`;
}

/** robots.txt: todo abierto y dónde está el sitemap. */
export const robots = ({ sitio = SITIO_POR_DEFECTO, base = '/' } = {}) =>
  `User-agent: *\nAllow: /\n\nSitemap: ${absoluta(sitio, base, 'sitemap.xml')}\n`;
