# v2: lo que se planeó contra lo que se construyó

> Auditoría del 2026-09-03, contrastada **contra el código**, no contra el
> recuerdo. Cada "no" de aquí abajo lleva el comando que lo demuestra.
>
> Documentos auditados: `VERSION-2.md`, `esquema-ficha.md`, `panel-privado.md`,
> `rediseno-fichas.md`, `integracion-jellyfin.md`.

## Resumen

**Hecho: 22 de 27** de las cosas concretas que piden los cinco documentos
(las fichas hermanas se cerraron la tarde de la auditoría). Lo que falta son
**5 piezas de la web pública y del panel**, y ninguna bloquea a otra.

| Documento | Hecho | Falta |
|---|---|---|
| `esquema-ficha.md` | 8 / 8 | — |
| `rediseno-fichas.md` | 5 / 6 | Whakoom (investigado, no construido) |
| `panel-privado.md` | 7 / 9 | `_revisar` tras publicar · "clonar a manga" |
| `integracion-jellyfin.md` | 8 / 10 | portadas locales · OG tags |
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

### 2. Las portadas siguen colgando de terceros

`integracion-jellyfin.md` §3.3. **8 de 8 fichas de anime** apuntan fuera:

```bash
grep -c '"image": "http' public/data/anime.json   # 8
ls public/covers                                   # no existe
```

Crunchyroll, Netflix, wikia, JustWatch, Amazon y MyAnimeList. Esas URLs llevan
tokens que rotan, y cuando una caduca **no te enteras**, porque el placeholder
gris de `CoverImage.jsx` lo disimula educadamente.

Y ahora pesa más que antes: el generador ya trae `coverImage` de AniList en los
34 borradores. Si se publican tal cual, pasan de 8 portadas frágiles a 42.

### 3. Al publicar un borrador se pierde el "revisar esto"

`panel-privado.md` §3 pedía que el panel enseñe los campos marcados en
`_meta._revisar` *"en un bloque aparte de revisar lo que propuso la máquina,
visualmente distinto de escribe lo tuyo"*.

Está a medias: **en la vista de borradores sí sale**; al publicar, `promover()`
descarta `_meta` y esa información desaparece. Así que una ficha recién publicada
con `chapters` dudoso o `description` propuesta por Ollama se ve idéntica a una
que Carlos revisó entera.

El arreglo acordado en la verificación adversarial es un side-car
`panel/revisar.json` fuera de `public/`, escrito al promocionar. No está hecho.

### 4. Vista previa al compartir (OG tags por ficha)

`integracion-jellyfin.md` §3.9. El TODO sigue literalmente abierto:

```
index.html:18   TODO al migrar al servidor propio: añadir <meta property="og:url"> y
index.html:19   <meta property="og:image"> con la URL absoluta definitiva del dominio.
```

Y ya no hay excusa: el dominio propio existe desde ayer. Hoy todas las URLs
comparten el mismo título genérico sin imagen, así que compartir `/anime/2` por
WhatsApp manda un rectángulo gris.

### 5. Botón "clonar a manga"

`panel-privado.md`. Copiar los campos comunes y crear la ficha hermana enlazada.
Encaja con el punto 1 y con que manga y novelas tengan una ficha cada uno.

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
