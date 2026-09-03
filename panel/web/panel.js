// La interfaz del panel. Sin framework a propósito: son cuatro pantallas y así
// no hay que compilar nada para usarlo.
//
// buildDiary y ESQUEMA se importan del MISMO código que pinta la web pública
// (el servidor los sirve bajo /m/), así que lo que ves agrupado aquí es
// exactamente lo que se va a publicar. No hay dos verdades.
import { buildDiary, normalizeEntries } from '/m/entries.js';
import { ESQUEMA } from '/m/niveles.js';
import { itemRating, isUnrated, showRating } from '/m/rating.js';
import { CONSULTA, interpretar, construirBandeja, explicarError } from '/m/pendientes.js';

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, hijos = []) => {
  // `dataset` es una propiedad de SÓLO LECTURA: hay que escribir dentro de ella,
  // no encima. Con Object.assign directo el navegador lanza
  // "Cannot set property dataset ... which has only a getter" y la página no
  // arranca entera. Las demás que se usan aquí (style, value, textContent...) sí
  // tienen setter.
  const { dataset, ...resto } = props;
  const n = Object.assign(document.createElement(tag), resto);
  if (dataset) Object.assign(n.dataset, dataset);
  for (const h of [].concat(hijos)) n.append(h);
  return n;
};

const estado = {
  secciones: [], clave: null, datos: null, fichaId: null, filtro: '',
  // Los borradores son una vista aparte: no son fichas publicadas todavía.
  enBorradores: false, borradores: [], borradorId: null, categorias: {},
  // La bandeja de pendientes: lo que AniList dice que ha visto y no ha comentado.
  enPendientes: false, anilist: '', bandeja: null,
  // Lo que propuso la máquina al publicar y aún no se ha mirado (panel/revisar.json).
  revisar: {},
};

function avisar(mensaje) {
  const a = $('#aviso');
  a.textContent = mensaje;
  a.style.display = 'block';
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.style.display = 'none'; }, 6000);
}

// El token lo inyecta el servidor en la página. Va en cabecera propia y no en
// `Authorization`, que en modo servidor lo ocupa la Access List de NPM.
const TOKEN = document.querySelector('meta[name="panel-token"]')?.content ?? '';

async function api(ruta, opciones = {}) {
  const r = await fetch(ruta, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), 'X-Panel-Token': TOKEN },
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || `HTTP ${r.status}`);
  return cuerpo;
}

const enviarOp = async (op) => {
  const r = await api(`/api/${estado.clave}/op`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op),
  });
  refrescarEstado();
  return r;
};

// Cuánto falta por publicarse. En modo servidor el 200 llega en cuanto se
// commitea, y el timer publica en un par de minutos: la interfaz lo dice en vez
// de dar a entender que ya está en línea.
async function refrescarEstado() {
  try {
    const e = await api('/api/estado');
    $('#estado').textContent = e.pendientes
      ? `${e.pendientes} cambio${e.pendientes > 1 ? 's' : ''} · se publica en ~2 min`
      : 'todo publicado';
  } catch { /* sin conexión: el aviso ya sale por otro lado */ }
}

// ------------------------------------------------------------------ secciones
async function arrancar() {
  const info = await api('/api/secciones');
  estado.secciones = info.secciones;
  $('#modo').textContent = info.modo === 'local' ? 'en este PC' : 'en Pavilion';

  const caja = $('#secciones');
  for (const s of info.secciones) {
    caja.append(el('button', {
      textContent: s.etiqueta,
      onclick: () => abrirSeccion(s.clave),
      dataset: { clave: s.clave },
    }));
  }
  // La otra mitad del panel: lo que el generador ha dejado a medias.
  botonBorradores = el('button', {
    textContent: 'Borradores',
    onclick: () => abrirBorradores(),
    dataset: { clave: '__borradores' },
  });
  caja.append(el('div', { style: 'height:14px' }), botonBorradores);

  // Sólo si hay usuario configurado. Sin él no es un error: es que no se usa.
  estado.anilist = info.anilist || '';
  if (estado.anilist) {
    botonPendientes = el('button', {
      textContent: 'Pendientes',
      onclick: () => abrirPendientes(),
      dataset: { clave: '__pendientes' },
    });
    caja.append(botonPendientes);
  }

  await cargarRevisar();
  await abrirSeccion(info.secciones[0].clave);
  refrescarEstado();
  contarBorradores();
  setInterval(refrescarEstado, 30000);
}

async function cargarRevisar() {
  try {
    estado.revisar = await api('/api/revisar');
  } catch { estado.revisar = {}; }
}
const revisarDe = (clave, id) => estado.revisar?.[clave]?.[String(id)] ?? null;

let botonBorradores = null;
let botonPendientes = null;

async function contarBorradores() {
  try {
    const { borradores, categorias } = await api('/api/borradores');
    estado.borradores = borradores;
    estado.categorias = categorias;
    const pendientes = borradores.filter((b) => !b.yaPublicado).length;
    botonBorradores.textContent = pendientes ? `Borradores (${pendientes})` : 'Borradores';
  } catch { /* si falla, el botón se queda sin número y ya */ }
}

function marcarSeccion(clave) {
  for (const b of document.querySelectorAll('#secciones button')) {
    b.setAttribute('aria-current', String(b.dataset.clave === clave));
  }
}

async function abrirSeccion(clave) {
  estado.clave = clave;
  estado.fichaId = null;
  estado.enBorradores = false;
  estado.enPendientes = false;
  estado.datos = await api(`/api/${clave}`);
  // Lo que se cacheó de las otras secciones para elegir hermanas puede haber
  // cambiado (se publicó un borrador): se vuelve a pedir cuando haga falta.
  for (const k of Object.keys(otras)) delete otras[k];
  marcarSeccion(clave);
  $('#detalle').replaceChildren(el('p', { className: 'vacio', textContent: 'Elige una ficha de la izquierda.' }));
  pintarLista();
}

const seccionActual = () => estado.secciones.find((s) => s.clave === estado.clave);

// ----------------------------------------------------------------- borradores
async function abrirBorradores() {
  estado.enBorradores = true;
  estado.enPendientes = false;
  estado.borradorId = null;
  marcarSeccion('__borradores');
  $('#detalle').replaceChildren(
    el('p', { className: 'vacio', textContent: 'Cargando borradores...' }),
  );
  const { borradores, categorias } = await api('/api/borradores');
  estado.borradores = borradores;
  estado.categorias = categorias;
  pintarLista();
  $('#detalle').replaceChildren(el('p', {
    className: 'vacio',
    textContent: borradores.length
      ? 'Elige un borrador para revisarlo y publicarlo.'
      : 'No hay borradores. Los deja el generador en la rama «borradores».',
  }));
}

function pintarListaBorradores(lista) {
  const filtro = estado.filtro.toLowerCase();
  const items = estado.borradores.filter(
    (b) => !filtro || `${b.title} ${b.japaneseTitle}`.toLowerCase().includes(filtro),
  );

  for (const b of items) {
    const fila = el('div', { className: 'fila', onclick: () => abrirBorrador(b) },
      [el('span', { className: 't', textContent: b.title })]);
    fila.setAttribute('aria-current', String(b.id === estado.borradorId));
    if (b.yaPublicado) {
      fila.append(el('span', { className: 'pin diario', textContent: 'ya está' }));
    } else if (b.falta.length) {
      // Decirlo aquí, no al pulsar el botón.
      fila.append(el('span', { className: 'pin pendiente', textContent: 'incompleto' }));
    }
    lista.append(fila);
  }
}

async function abrirBorrador(resumen) {
  estado.borradorId = resumen.id;
  pintarLista();
  const b = await api(`/api/borradores/${resumen.seccion}/${resumen.id}`);
  const main = $('#detalle');

  const aviso = (texto, clase) => el('div', {
    className: 'nueva',
    style: 'margin-bottom:14px',
  }, [el('div', { className: clase, textContent: texto })]);

  const trozos = [
    el('h2', { textContent: b.title }),
    el('div', { className: 'jp', textContent: b.japaneseTitle ?? '' }),
  ];

  if (resumen.yaPublicado) {
    trozos.push(aviso('Esta franquicia ya está publicada en la web.', 'grupo'));
  }
  if (resumen.falta.length) {
    trozos.push(aviso(
      `Incompleto: le falta ${resumen.falta.join(', ')}. Suele pasar cuando se generó ` +
      'con AniList caído. Vuelve a generarlo antes de publicarlo.', 'grupo'));
  }
  if (resumen.revisar.length) {
    trozos.push(aviso(`Revisa lo que propuso la máquina: ${resumen.revisar.join(', ')}`, 'grupo'));
  }
  for (const a of resumen.avisos ?? []) trozos.push(aviso(a, 'grupo'));

  // Lo que trae la máquina, para que decida si le vale.
  trozos.push(el('h3', { textContent: 'Lo que ha encontrado la máquina' }));
  // Lo que se enseña depende de la sección del borrador. Antes esto era la
  // lista de anime para todos: a un manga le decía «Episodios: —» y «¿Tiene
  // manga? No», que es mentira por construcción.
  const sec = resumen.seccion;
  const propios = sec === 'anime'
    ? [['Episodios', b.episodes]]
    : sec === 'manga'
      ? [['Capítulos / volúmenes', [b.chapters, b.volumes].filter(Boolean).join(' / ')], ['Autor', b.author]]
      : [['Volúmenes', b.volumes], ['Autor', b.author], ['Ilustrador', b.illustrator]];
  const hermanasDe = (ESQUEMA[sec]?.hermanas ?? []).map((h) => [
    `¿Tiene ${ESQUEMA[h].nombre}?`, b[ESQUEMA[h].bandera] ? 'Sí' : 'No',
  ]);
  const datos = [
    ...propios,
    ['Géneros', (b.genres ?? []).join(', ')],
    ...hermanasDe,
    ...(sec === 'anime'
      ? [['Openings', `${(b.openings ?? []).length}`], ['Endings', `${(b.endings ?? []).length}`]]
      : []),
    ['Fuente', resumen.fuente],
  ];
  for (const [k, v] of datos) {
    trozos.push(el('div', { className: 'campo' }, [
      el('label', { textContent: k }),
      el('div', { textContent: v || '—' }),
    ]));
  }
  if (b.description) {
    trozos.push(el('div', { className: 'campo' }, [
      el('label', { textContent: 'Descripción propuesta' }),
      el('div', { textContent: b.description }),
    ]));
  }

  // Publicar. La categoría es suya: nadie puede deducir si lo ha visto.
  trozos.push(el('h3', { textContent: 'Publicarlo' }));
  // Las de la sección DEL BORRADOR, que puede no ser la que está abierta:
  // "Visto/Viendo" en anime no valen para manga, que usa "Leído/Leyendo".
  const cats = estado.categorias?.[resumen.seccion] ?? [];
  const selector = el('select');
  selector.append(el('option', { value: '', textContent: '¿En qué categoría?' }));
  for (const c of cats) selector.append(el('option', { value: c, textContent: c }));

  const boton = el('button', { className: 'principal', textContent: 'Publicar ficha' });
  boton.onclick = async () => {
    if (!selector.value) return avisar('Elige una categoría: eso no lo puede saber la máquina.');
    boton.disabled = true;
    try {
      const r = await api(`/api/borradores/${resumen.seccion}/${resumen.id}/promocionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: selector.value }),
      });
      await contarBorradores();
      await cargarRevisar();
      await abrirSeccion(resumen.seccion);
      abrirFicha(r.ficha.id);
      refrescarEstado();
    } catch (e) {
      avisar(e.message);
      boton.disabled = false;
    }
  };

  trozos.push(el('div', { className: 'nueva' }, [
    selector,
    el('div', { style: 'margin-top:10px' }, [boton]),
  ]));

  main.replaceChildren(...trozos);
}

// ------------------------------------------------------------- pendientes
// La consulta a AniList se hace DESDE AQUÍ, desde el navegador, y no desde el
// servidor del panel. No es un capricho: ese servicio corre con IPAddressDeny=any
// (ver deploy/panel/carlos-opinion-panel.service) y no tiene salida a internet a
// propósito, por ser el proceso siempre en pie y expuesto por NPM. Abrírsela para
// leer una lista de episodios sería empeorar el endurecimiento a cambio de nada.
async function consultarAniList(ids) {
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: CONSULTA, variables: { usuario: estado.anilist, ids } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error(explicarError(r.status, j.errors));
  return j;
}

async function abrirPendientes() {
  estado.enPendientes = true;
  estado.enBorradores = false;
  marcarSeccion('__pendientes');
  pintarLista();
  const main = $('#detalle');
  main.replaceChildren(el('p', { className: 'vacio', textContent: 'Preguntando a AniList...' }));

  try {
    // La bandeja es de anime: es donde hay episodios que ver.
    const datos = estado.clave === 'anime' ? estado.datos : await api('/api/anime');
    const ids = [...new Set((datos.items ?? []).flatMap((i) => i.anilistIds ?? []))];
    if (!ids.length) {
      return main.replaceChildren(el('p', { className: 'vacio',
        textContent: 'Ninguna ficha declara anilistIds, así que no hay nada que cruzar.' }));
    }
    const { listasPorId, formatos } = interpretar(await consultarAniList(ids));
    estado.bandeja = construirBandeja(datos.items, listasPorId, formatos);
    pintarPendientes();
  } catch (e) {
    main.replaceChildren(
      el('h3', { textContent: 'No se ha podido leer AniList' }),
      el('p', { style: 'color:#94a3b8', textContent: e.message }),
    );
  }
}

function pintarPendientes() {
  const main = $('#detalle');
  const bandeja = estado.bandeja ?? [];
  const total = bandeja.reduce((n, b) => n + b.filas.length, 0);
  if (botonPendientes) {
    botonPendientes.textContent = total ? `Pendientes (${total})` : 'Pendientes';
  }

  if (!total) {
    return main.replaceChildren(
      el('h2', { textContent: 'Al día' }),
      el('p', { style: 'color:#94a3b8', textContent:
        `Nada que comentar. Marca episodios en AniList como «${estado.anilist}» y aparecerán aquí.` }),
    );
  }

  const trozos = [
    el('h2', { textContent: 'Pendientes de comentar' }),
    el('div', { className: 'jp', textContent:
      `Según AniList (${estado.anilist}). La opinión y la nota las escribes tú.` }),
  ];

  for (const grupo of bandeja) {
    trozos.push(el('h3', { textContent: grupo.ficha.title }));
    for (const fila of grupo.filas) trozos.push(pintarFilaPendiente(grupo.ficha, fila));
    if (grupo.recortadas) {
      trozos.push(el('p', { style: 'color:#94a3b8;font-size:13px',
        textContent: `y ${grupo.recortadas} episodio${grupo.recortadas > 1 ? 's' : ''} más atrás.` }));
    }
  }
  main.replaceChildren(...trozos);
}

function pintarFilaPendiente(ficha, fila) {
  const etiqueta = (fila.season ? `T${fila.season} · ` : '') + `Episodio ${fila.episode}`;
  const nota = el('input', { type: 'number', min: '0', max: '10', step: '0.1', placeholder: 'nota' });
  const texto = el('input', { type: 'text', placeholder: '¿Qué te ha parecido?' });
  const boton = el('button', { className: 'principal', textContent: 'Guardar' });
  const caja = el('div', { className: 'nueva', style: 'margin-bottom:10px' });

  boton.onclick = async () => {
    if (!texto.value.trim() && !nota.value) {
      return avisar('Escribe algo o pon una nota: una entrada vacía no dice nada.');
    }
    boton.disabled = true;
    try {
      // El localizador y la fecha vienen de AniList; el texto y la nota, de él.
      const entrada = { episode: fila.episode };
      if (fila.season) entrada.season = fila.season;
      if (fila.date) entrada.date = fila.date;
      if (nota.value) entrada.rating = nota.value;
      if (texto.value.trim()) entrada.text = texto.value;

      await api(`/api/anime/op`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'entry.add', id: ficha.id, entrada }),
      });
      refrescarEstado();
      caja.replaceChildren(el('div', { className: 'grupo',
        textContent: `${etiqueta} · guardado` }));
      // Fuera de la bandeja: ya está comentado.
      estado.bandeja = estado.bandeja
        .map((g) => ({ ...g, filas: g.filas.filter((f) => f.clave !== fila.clave) }))
        .filter((g) => g.filas.length);
      const quedan = estado.bandeja.reduce((n, g) => n + g.filas.length, 0);
      if (botonPendientes) botonPendientes.textContent = quedan ? `Pendientes (${quedan})` : 'Pendientes';
    } catch (e) {
      avisar(e.message);
      boton.disabled = false;
    }
  };

  caja.append(
    el('div', { className: 'linea' }, [
      el('div', { style: 'flex:0 0 auto' }, [el('label', { textContent: fila.date || 'sin fecha' }),
        el('div', { className: 'et', textContent: etiqueta })]),
      el('div', { style: 'flex:0 0 90px' }, [el('label', { textContent: 'Nota' }), nota]),
      el('div', { style: 'flex:1' }, [el('label', { textContent: 'Opinión' }), texto]),
    ]),
    el('div', {}, [boton]),
  );
  return caja;
}

// ---------------------------------------------------------------------- lista
function pintarLista() {
  const lista = $('#lista');
  for (const n of [...lista.children]) if (n.id !== 'buscador') n.remove();

  if (estado.enPendientes) return;
  if (estado.enBorradores) return pintarListaBorradores(lista);

  const filtro = estado.filtro.toLowerCase();
  const items = estado.datos.items.filter(
    (i) => !filtro || `${i.title} ${i.japaneseTitle ?? ''}`.toLowerCase().includes(filtro),
  );

  for (const item of items) {
    const nota = itemRating(item);
    const diario = normalizeEntries(item.entries).length;
    const fila = el('div', {
      className: 'fila',
      onclick: () => abrirFicha(item.id),
    }, [el('span', { className: 't', textContent: item.title })]);
    fila.setAttribute('aria-current', String(String(item.id) === String(estado.fichaId)));

    if (nota !== null) fila.append(el('span', { className: 'pin nota', textContent: showRating(nota) }));
    if (diario) fila.append(el('span', { className: 'pin diario', textContent: `${diario}` }));
    // La lista de lo que le falta por escribir, que es para lo que abre esto.
    if (isUnrated(item)) fila.append(el('span', { className: 'pin pendiente', textContent: 'sin opinar' }));
    if (revisarDe(estado.clave, item.id)) fila.append(el('span', { className: 'pin revisar', textContent: 'revisar' }));
    lista.append(fila);
  }
}

$('#buscador').addEventListener('input', (e) => {
  estado.filtro = e.target.value;
  pintarLista();
});

// -------------------------------------------------------------------- detalle
const fichaActual = () => estado.datos.items.find((i) => String(i.id) === String(estado.fichaId));

function abrirFicha(id) {
  estado.fichaId = id;
  pintarLista();
  pintarDetalle();
}

function pintarDetalle() {
  const item = fichaActual();
  const main = $('#detalle');
  main.replaceChildren(
    el('h2', { textContent: item.title }),
    el('div', { className: 'jp', textContent: item.japaneseTitle ?? '' }),
    ...pintarRevisar(item),
    el('h3', { textContent: 'Lo que escribes tú' }),
    ...seccionActual().campos.map((campo) => pintarCampo(item, campo)),
    el('h3', { textContent: 'La misma obra en otra sección' }),
    el('div', { id: 'hermanas' }),
    el('h3', { textContent: ESQUEMA[estado.clave].diaryTitle }),
    pintarNueva(),
    el('div', { id: 'diario' }),
  );
  pintarHermanas(item);
  pintarDiario();
}

// ------------------------------------------------------------ fichas hermanas
// El enlace `related` es EXPLÍCITO: se elige la ficha de la otra sección de una
// lista, nunca se adivina por título. El servidor lo escribe en las dos fichas.
const otras = {}; // los datos de cada otra sección (fichas y categorías), para elegir

async function datosDe(clave) {
  if (clave === estado.clave) return estado.datos;
  if (!otras[clave]) otras[clave] = await api(`/api/${clave}`);
  return otras[clave];
}

async function pintarHermanas(item) {
  const caja = $('#hermanas');
  if (!caja) return;
  const cajas = [];
  for (const hermana of ESQUEMA[estado.clave].hermanas) {
    const marca = el('span', { className: 'guardado' });
    const control = el('select');
    control.append(el('option', { value: '', textContent: '— sin ficha —' }));
    const actual = item.related?.[hermana];
    let candidatas = [];
    let categorias = [];
    try {
      const d = await datosDe(hermana);
      candidatas = d.items ?? [];
      categorias = d.categories ?? [];
    } catch (e) {
      avisar(`No se pudo leer ${ESQUEMA[hermana].nombre}: ${e.message}`);
    }
    for (const f of candidatas) {
      control.append(el('option', {
        value: String(f.id), textContent: f.title, selected: String(f.id) === String(actual ?? ''),
      }));
    }
    control.onchange = async () => {
      try {
        const { ficha } = await api(`/api/${estado.clave}/hermana`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, seccion: hermana, hermanaId: control.value }),
        });
        // La ficha vuelve entera; `related` puede haber desaparecido.
        const mia = fichaActual();
        for (const k of Object.keys(mia)) if (!(k in ficha)) delete mia[k];
        Object.assign(mia, ficha);
        // La otra sección ha cambiado en disco: se vuelve a pedir la próxima vez.
        delete otras[hermana];
        marca.textContent = 'guardado';
        setTimeout(() => { marca.textContent = ''; }, 1800);
        refrescarEstado();
      } catch (e) {
        avisar(`No se guardó el enlace: ${e.message}`);
        control.value = String(fichaActual().related?.[hermana] ?? '');
      }
    };
    const caja = el('div', { className: 'campo' }, [
      el('label', {}, [`¿Tiene ${ESQUEMA[hermana].nombre}? Su ficha:`, marca]),
      control,
    ]);

    // Sin ficha al otro lado: crearla desde ésta. Copia lo objetivo (título,
    // portada, géneros, sinopsis), deja lo suyo vacío y la enlaza. La categoría
    // es suya, como al publicar un borrador.
    if (actual === undefined || actual === null || actual === '') {
      const cat = el('select');
      cat.append(el('option', { value: '', textContent: '¿En qué categoría?' }));
      for (const c of categorias) cat.append(el('option', { value: c, textContent: c }));
      const crear = el('button', { className: 'fantasma', textContent: `Crear la ficha de ${ESQUEMA[hermana].nombre} a partir de ésta` });
      crear.onclick = async () => {
        if (!cat.value) return avisar('Elige una categoría: eso no lo puede saber la máquina.');
        crear.disabled = true;
        try {
          const r = await api(`/api/${estado.clave}/clonar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, seccion: hermana, categoria: cat.value }),
          });
          delete otras[hermana];
          refrescarEstado();
          // A la ficha nueva, en su sección: es donde toca escribir ahora.
          await abrirSeccion(r.seccion);
          abrirFicha(r.ficha.id);
        } catch (e) {
          avisar(`No se creó la ficha: ${e.message}`);
          crear.disabled = false;
        }
      };
      caja.append(el('div', { className: 'linea', style: 'margin-top:6px' }, [cat, crear]));
    }
    cajas.push(caja);
  }
  // Si mientras se cargaba se abrió otra ficha, no pisar lo que ya haya.
  if ($('#hermanas') === caja) caja.replaceChildren(...cajas);
}

// Lo que propuso la máquina al publicar y aún no ha mirado. Bloque aparte y
// distinto de "lo que escribes tú": son datos objetivos que el generador rellenó
// con menos certeza (episodios, sinopsis, géneros...). Se enseña el valor que
// quedó publicado y un botón para decir "visto".
function pintarRevisar(item) {
  const r = revisarDe(estado.clave, item.id);
  if (!r) return [];
  const caja = el('div', { className: 'revisar' });
  caja.append(el('h3', { textContent: 'Revisa lo que propuso la máquina' }));
  caja.append(el('div', { className: 'jp', textContent:
    `Publicada ${r.fecha || 'sin fecha'} desde ${r.fuente || 'el generador'}. ` +
    'La máquina no puede saber si esto está bien; míralo y márcalo como visto.' }));
  for (const campo of r.campos ?? []) {
    const v = item[campo];
    const texto = Array.isArray(v) ? v.join(', ') : (v == null || v === '' ? '—' : String(v));
    caja.append(el('div', { className: 'campo' }, [
      el('label', { textContent: campo }),
      el('div', { textContent: texto }),
    ]));
  }
  for (const a of r.avisos ?? []) caja.append(el('div', { className: 'grupo', textContent: a }));
  const boton = el('button', { className: 'principal', textContent: 'Ya lo he revisado' });
  boton.onclick = async () => {
    boton.disabled = true;
    try {
      const { revisar } = await api(`/api/${estado.clave}/revisar/${item.id}/hecho`, { method: 'POST' });
      estado.revisar = revisar ?? {};
      refrescarEstado();
      pintarLista();
      pintarDetalle();
    } catch (e) {
      avisar(`No se pudo marcar: ${e.message}`);
      boton.disabled = false;
    }
  };
  caja.append(el('div', { style: 'margin-top:10px' }, [boton]));
  return [caja];
}

// Sólo los campos que le tocan a él: los declara panel/lib/secciones.mjs y el
// servidor los manda. Por eso `willReadSource` no aparece en manga ni novelas.
function pintarCampo(item, campo) {
  const valor = item[campo.clave] ?? '';
  const marca = el('span', { className: 'guardado' });

  const guardar = async (control) => {
    if (control.value === (fichaActual()[campo.clave] ?? '')) return;
    try {
      const { ficha } = await enviarOp({ op: 'field.set', id: item.id, campo: campo.clave, valor: control.value });
      Object.assign(fichaActual(), ficha);
      marca.textContent = 'guardado';
      setTimeout(() => { marca.textContent = ''; }, 1800);
      pintarLista();
    } catch (e) {
      avisar(`No se guardó ${campo.etiqueta}: ${e.message}`);
      control.value = fichaActual()[campo.clave] ?? '';
    }
  };

  let control;
  if (campo.tipo === 'categoria') {
    control = el('select');
    for (const c of estado.datos.categories) {
      control.append(el('option', { value: c, textContent: c, selected: c === valor }));
    }
    control.onchange = () => guardar(control);
  } else if (campo.tipo === 'parrafo') {
    control = el('textarea', { value: valor });
    control.onblur = () => guardar(control);
  } else {
    control = el('input', { type: 'text', value: valor, placeholder: 'p. ej. 9/10' });
    control.onblur = () => guardar(control);
  }

  return el('div', { className: 'campo' }, [
    el('label', {}, [campo.etiqueta, marca]),
    control,
  ]);
}

// ------------------------------------------------------- añadir al diario
function pintarNueva() {
  const niveles = ESQUEMA[estado.clave].levels;
  const entradas = {};
  const linea = el('div', { className: 'linea' });

  for (const nivel of niveles) {
    const input = el('input', { type: 'number', min: '0', placeholder: nivel.label });
    entradas[nivel.key] = input;
    linea.append(el('div', {}, [el('label', { textContent: nivel.label }), input]));
  }
  const nota = el('input', { type: 'number', min: '0', max: '10', step: '0.1', placeholder: '0-10' });
  entradas.rating = nota;
  linea.append(el('div', {}, [el('label', { textContent: 'Nota' }), nota]));

  const texto = el('textarea', { placeholder: '¿Qué te ha parecido?' });
  const boton = el('button', { className: 'principal', textContent: 'Añadir' });

  boton.onclick = async () => {
    const entrada = {};
    for (const [k, input] of Object.entries(entradas)) if (input.value !== '') entrada[k] = input.value;
    if (texto.value.trim()) entrada.text = texto.value;
    boton.disabled = true;
    try {
      const { ficha } = await enviarOp({ op: 'entry.add', id: estado.fichaId, entrada });
      Object.assign(fichaActual(), ficha);
      // Los niveles se conservan: escribir el episodio 8 y luego el 9 no debería
      // obligar a teclear la temporada otra vez.
      texto.value = '';
      nota.value = '';
      const ultimo = niveles.at(-1);
      if (ultimo && entradas[ultimo.key].value !== '') {
        entradas[ultimo.key].value = String(Number(entradas[ultimo.key].value) + 1);
      }
      pintarDiario();
      pintarLista();
    } catch (e) {
      avisar(e.message);
    } finally {
      boton.disabled = false;
    }
  };

  return el('div', { className: 'nueva' }, [linea, texto, el('div', { style: 'margin-top:10px' }, [boton])]);
}

// ------------------------------------------------------------- pintar diario
function pintarDiario() {
  const caja = $('#diario');
  const item = fichaActual();
  const diario = buildDiary(item.entries, ESQUEMA[estado.clave].levels);
  caja.replaceChildren();

  if (diario.total === 0) {
    caja.append(el('p', { style: 'color:#94a3b8;margin-top:14px', textContent: 'Todavía no hay nada escrito aquí.' }));
    return;
  }

  for (const grupo of diario.groups) {
    if (diario.grouped) caja.append(el('div', { className: 'grupo', textContent: grupo.label }));
    for (const { entry, label } of grupo.items) {
      const cab = el('div', { className: 'cab' });
      if (label) cab.append(el('span', { className: 'et', textContent: label }));
      if (typeof entry.rating === 'number') cab.append(el('span', { className: 'rt', textContent: `${entry.rating}/10` }));
      if (entry.date) cab.append(el('span', { className: 'fe', textContent: entry.date }));
      if (entry.id) {
        cab.append(el('button', {
          className: 'fantasma',
          textContent: 'borrar',
          onclick: async () => {
            try {
              const { ficha } = await enviarOp({ op: 'entry.remove', id: item.id, entradaId: entry.id });
              Object.assign(fichaActual(), ficha);
              if (!ficha.entries) delete fichaActual().entries;
              pintarDiario();
              pintarLista();
            } catch (e) { avisar(e.message); }
          },
        }));
      }
      caja.append(el('div', { className: 'entrada' }, [
        cab,
        ...(entry.text ? [el('div', { textContent: entry.text })] : []),
      ]));
    }
  }
}

arrancar().catch((e) => avisar(`No se pudo arrancar: ${e.message}`));
