# v2: lo que se planeó contra lo que se construyó

> Auditoría del 2026-09-03, contrastada **contra el código**, no contra el
> recuerdo. Cada "no" de aquí abajo lleva el comando que lo demuestra.
>
> Documentos auditados: `VERSION-2.md`, `esquema-ficha.md`, `panel-privado.md`,
> `rediseno-fichas.md`, `integracion-jellyfin.md`.

## Resumen

**Hecho: 26 de 27** de las cosas concretas que piden los cinco documentos
(los cinco puntos de abajo se cerraron la tarde de la auditoría). Lo único que
falta es **el importador de Whakoom**.

| Documento | Hecho | Falta |
|---|---|---|
| `esquema-ficha.md` | 8 / 8 | — |
| `rediseno-fichas.md` | 5 / 6 | Whakoom (investigado, no construido) |
| `panel-privado.md` | 9 / 9 | — |
| `integracion-jellyfin.md` | 10 / 10 | — |
| `VERSION-2.md` | 5 / 5 piezas | — |

---

## Lo que falta, por orden de lo que yo haría

### 1. Enlazar las fichas hermanas (`related`) — HECHO (2026-09-03)

`integracion-jellyfin.md` §3.7. Era la única propuesta que salió en las cuatro
tandas del análisis. Ahora:

- `related: { manga: 1 }` es un enlace **explícito** en las dos fichas; nunca se
  adivina por título (`src/lib/related.js`, tres estados: no / existe / ficha).
- El modal pinta un botón «Ver el manga →» sólo cuando hay ficha al otro lado.
- El panel tiene un selector por sección hermana con las fichas publicadas de
  esa sección; `POST /api/:seccion/hermana` escribe **los dos ficheros en un
  commit** (`panel/lib/hermanas.mjs`), y al cambiar de hermana la anterior
  pierde su enlace.

Aún no hay ningún `related` en los datos reales: Chainsaw Man está en manga y su
anime sigue en borradores. Cuando Carlos publique ese borrador, lo enlaza desde
el panel.

### 2. Las portadas siguen colgando de terceros — HECHO (2026-09-03)

`integracion-jellyfin.md` §3.3. Las 10 fichas publicadas tienen ya su portada en
`public/covers/` (la de Mushoku Tensei en MyAnimeList **ya estaba muerta**, 404;
se sustituyó por la de AniList). La procedencia de cada fichero, con la URL
original, está en `public/covers/origen.json`.

- `npm run portadas` en el PC: baja lo que siga fuera y reescribe `image`.
- `panel/empujar.mjs` en Pavilion hace lo mismo antes de cada publicación, así
  que una ficha publicada desde el móvil pierde la URL de AniList en ~2 min.
- Reglas (`panel/lib/portadas.mjs`): nunca se deja `image` en blanco; el tipo
  sale de los bytes, no de la URL; un 404 se anota y no se reintenta; un fallo
  de red sí; si la original ha muerto y hay `anilistIds`, se usa AniList.
- `scripts/test-entries.mjs` comprueba que toda portada local exista de verdad.

### 3. Al publicar un borrador se pierde el "revisar esto" — HECHO (2026-09-03)

`panel-privado.md` §3. Al publicar (desde el panel o con `scripts/promote.mjs`)
lo que el generador marcó en `_meta._revisar`, junto con sus avisos, la fuente y
la fecha, se apunta en **`panel/revisar.json`** (fuera de `public/`, commiteado
con la ficha). El panel lo enseña en la ficha publicada en un bloque aparte,
«Revisa lo que propuso la máquina», con el valor que quedó publicado de cada
campo y un botón «Ya lo he revisado» que lo quita. La lista marca esas fichas
con un pin «revisar». `panel/lib/revisar.mjs` es puro y está probado.

### 4. Vista previa al compartir (OG tags por ficha) — HECHO (2026-09-03)

`integracion-jellyfin.md` §3.9. Tras `vite build`, `scripts/og.mjs` escribe una
copia de `index.html` por sección (`anime.html`) y por ficha (`anime/2.html`)
con `<title>`, description, `og:title`, `og:description`, `og:url`, `og:image`
y `twitter:image` de esa ficha, con URLs absolutas del dominio propio (portada
local incluida). nginx las sirve con `try_files $uri $uri.html …`: WhatsApp,
Telegram o Discord ven título y portada al compartir `/anime/2`; para el
navegador es la misma app. La web sigue siendo estática. Además la pestaña
cambia de título al abrir una ficha. `scripts/test-og.mjs` lo prueba con los
tipos reales.

### 5. Botón "clonar a manga" — HECHO (2026-09-03)

`panel-privado.md`. En el bloque de hermanas de una ficha, donde no hay ficha
al otro lado, el panel ofrece «Crear la ficha de manga a partir de ésta» con un
selector de categoría **de la sección destino**. `panel/lib/clonar.mjs` copia lo
objetivo y común (título, título japonés, portada, descripción, géneros,
sinopsis), deja vacío lo de la sección (capítulos, autor…) y lo que sólo escribe
Carlos, no copia `anilistIds` ni el diario, y la enlaza en las dos direcciones
con `enlazar()`. Dos ficheros, un commit. Si ya hay hermana, se niega.

### 6. Whakoom

`rediseno-fichas.md`. Investigado a fondo y **con veredicto**: no tiene API y
raspar está prohibido por sus condiciones de uso. El único camino es la
exportación manual, que Carlos tiene por ser PRO. El emparejador está diseñado y
sin construir.

Ojo con el reparto real de trabajo: el 70% de "lo de Whakoom" era la pieza 3, el
generador de manga y novelas — **y esa ya está hecha**. Lo que queda es un
emparejador de nombres a ids que correría en su PC.

---

## Desviaciones deliberadas del plan

No son olvidos: se decidieron a propósito y conviene que quede escrito.

**TMDB nunca se usó.** `integracion-jellyfin.md` lo proponía para `episodes` y
para la sinopsis en español.

```bash
grep -c "tmdb\|TMDB" generador/generar.py    # 0
```

En su lugar: AniList para el alcance de la franquicia y Ollama para traducir. Un
registro menos, una clave de API menos, y calibrado contra las 8 fichas reales.
Si algún día la traducción de Ollama molesta, TMDB sigue siendo la alternativa.

**El generador no tiene timer.** La fase 3 del plan pedía una unidad de systemd
nocturna. Hoy se dispara a mano (`esperar-y-generar.sh` fue una ejecución suelta).
No se ha echado en falta: se añade ~1 anime al mes y el panel ya enseña los
borradores pendientes, así que el buzón que el plan quería resolver con
`PENDIENTES.md` ya está resuelto mejor.

**El "editor local" se convirtió en el panel alojado.** El propio
`panel-privado.md` ya lo decía: *"su versión es mejor"*.

---

## Lo que se hizo y no estaba en ningún plan

Salió de la verificación adversarial, y sin ello el resto sería frágil:

- **El circuito de despliegue, blindado.** Comprobado ejecutando git que un
  `post-receive` que falla **NO hace fallar el push**: devuelve exit 0 y la web
  se queda en la versión anterior en silencio. Ahora hay hook `update` que impide
  reescribir `main`, reflog activado, `flock`, y `npm run deploy` que compara la
  revisión realmente publicada.
- **`anilistIds` en las 10 fichas.** Sin ellos la comprobación de duplicados era
  un no-op y publicar *Rascal* o *My Dress-Up Darling* desde el panel habría
  creado una ficha repetida a un clic.
- **513 comprobaciones automáticas**, incluida una que arranca la interfaz del
  panel sobre un DOM mínimo. Existe porque se envió un panel que servía el JS
  perfectamente y moría en la primera línea al abrirlo.
- **La bandeja de pendientes de AniList**, que es la respuesta viable a lo que
  `panel-privado.md` pedía de Crunchyroll.

---

## Correcciones a los propios documentos

- `VERSION-2.md` habla de **cinco piezas** pero su bloque de orden lista cuatro,
  y luego dice *"la pieza 5 se puede empezar cuando sea"*. La numeración quedó
  descuadrada al marcar lo hecho.
- Su tabla sigue diciendo que el contenido saldrá *"de Jellyfin, Crunchyroll y
  Whakoom"*. Crunchyroll **no va a ser una fuente**: sus condiciones lo prohíben.
  La fuente es AniList, y Crunchyroll llega ahí por una extensión que instala
  Carlos, no por código nuestro.
- `integracion-jellyfin.md` §3.6 dice que el filtro "sin opinar" es *"el visor de
  la salida del generador"*. Sigue siendo verdad y ahora importa más: con 28
  borradores publicables, es lo que distingue una ficha que espera opinión de una
  terminada.
