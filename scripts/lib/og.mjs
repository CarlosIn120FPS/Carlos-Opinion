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
  if (!item) {
    return {
      title: tipo.pageTitle,
      description: recortar(tipo.pageDescription),
      url: absoluta(sitio, base, tipo.slug),
      image: '',
      type: 'website',
    };
  }
  return {
    title: `${item.title} · ${tipo.pageTitle}`,
    description: recortar(item.description || tipo.pageDescription),
    url: absoluta(sitio, base, `${tipo.slug}/${item.id}`),
    image: absoluta(sitio, base, item.image),
    type: 'article',
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
  return salida;
}
