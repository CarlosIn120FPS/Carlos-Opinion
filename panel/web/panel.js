// La interfaz del panel. Sin framework a propósito: son cuatro pantallas y así
// no hay que compilar nada para usarlo.
//
// buildDiary y ESQUEMA se importan del MISMO código que pinta la web pública
// (el servidor los sirve bajo /m/), así que lo que ves agrupado aquí es
// exactamente lo que se va a publicar. No hay dos verdades.
import { buildDiary, normalizeEntries } from '/m/entries.js';
import { ESQUEMA } from '/m/niveles.js';
import { itemRating, isUnrated, showRating } from '/m/rating.js';

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, hijos = []) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const h of [].concat(hijos)) n.append(h);
  return n;
};

const estado = { secciones: [], clave: null, datos: null, fichaId: null, filtro: '' };

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
  await abrirSeccion(info.secciones[0].clave);
  refrescarEstado();
  setInterval(refrescarEstado, 30000);
}

async function abrirSeccion(clave) {
  estado.clave = clave;
  estado.fichaId = null;
  estado.datos = await api(`/api/${clave}`);
  for (const b of document.querySelectorAll('#secciones button')) {
    b.setAttribute('aria-current', String(b.dataset.clave === clave));
  }
  $('#detalle').replaceChildren(el('p', { className: 'vacio', textContent: 'Elige una ficha de la izquierda.' }));
  pintarLista();
}

const seccionActual = () => estado.secciones.find((s) => s.clave === estado.clave);

// ---------------------------------------------------------------------- lista
function pintarLista() {
  const lista = $('#lista');
  for (const n of [...lista.children]) if (n.id !== 'buscador') n.remove();

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
    el('h3', { textContent: 'Lo que escribes tú' }),
    ...seccionActual().campos.map((campo) => pintarCampo(item, campo)),
    el('h3', { textContent: ESQUEMA[estado.clave].diaryTitle }),
    pintarNueva(),
    el('div', { id: 'diario' }),
  );
  pintarDiario();
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
