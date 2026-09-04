# Carlos' Opinion — contexto completo para un Claude sin acceso al repositorio ni a las máquinas

> Este documento es autocontenido. Quien lo lea no puede abrir ficheros, ejecutar
> comandos ni ver la web: todo lo que necesita saber está aquí. Estado a 3 de
> septiembre de 2026.

---

## 1. Qué es esto y para quién

**Carlos' Opinion** es la web personal de Carlos (Carlos Alexei Guasp Rubio,
usuario `CarlosIn120FPS` en AniList) con sus opiniones sobre los **animes**,
**mangas** y **novelas ligeras** que ve o lee. Tres secciones, cada una con sus
fichas. Cada ficha tiene datos objetivos (título, géneros, sinopsis, episodios,
portada) y lo que de verdad vale: **su opinión, su nota y su diario** episodio a
episodio o volumen a volumen.

- Web pública: `https://opinion.carlosin120fps.duckdns.org` (rutas `/anime`,
  `/manga`, `/novelas`, y `/anime/2` para una ficha concreta).
- Panel privado (solo él, con usuario y contraseña):
  `https://panel.carlosin120fps.duckdns.org`. Desde ahí escribe opiniones y
  diario, publica borradores y enlaza fichas, también desde el móvil.
- Todo está alojado en su **homelab** (un portátil viejo llamado **Pavilion**);
  GitHub es solo copia de seguridad.

Trabaja en español. Los commits, los comentarios del código y los documentos
están en español. Las claves de los datos van en inglés (`title`, `rating`).

## 2. Los principios que no se negocian

1. **La voz es suya.** Ninguna IA escribe opiniones, notas, ni entradas del
   diario, ni resúmenes de sus opiniones. La máquina rellena datos objetivos.
   Los campos suyos son: `category`, `rating`, `ratingFinal`, `personalOpinion`,
   `personalOpinionFinal`, `doIRecommend`, `willReadSource` (solo anime) y
   `entries` (el diario). Un borrador que traiga cualquiera de esos rellenos se
   rechaza al publicar.
2. **Nunca se escribe texto de ejemplo ni datos inventados** en los ficheros de
   contenido. Las pruebas usan fichas sintéticas dentro de los propios tests.
3. **Los tres modales tienen identidad propia** y se conserva: anime es
   *cristal esmerilado* (fondo oscuro translúcido, degradado morado→azul),
   manga es *viñeta de cómic* (bordes negros gruesos, sombras duras, fuente
   Comic Sans, bocadillos), novela es *libro* (papel crema con textura, fuente
   serif, páginas dobles con columnas CSS y pasar de página). Un rediseño cambia
   lo que muestran, no lo que son.
4. **La web es estática.** Sin backend para servirla: un nginx sirve ficheros.
   El panel es otro proceso, privado.
5. **El alojamiento es suyo.** GitHub nunca está en el camino de publicación.
6. **Los enlaces entre fichas son explícitos**, nunca adivinados por título (una
   vez se emparejó *Call of the Night* con *Shimoneta* por parecido de título).
7. **Lo que se dice hecho está hecho y verificado**: tests que cazan el fallo si
   se reintroduce, capturas reales para lo visual, despliegue comprobado.

## 3. Tecnología

- **Web**: React 19, Vite 7, Tailwind CSS 3, Framer Motion 12, React Router 7.
  Sin fuentes web ni recursos de terceros: portadas y textura de papel se sirven
  del propio dominio.
- **Datos**: tres JSON (`public/data/anime.json`, `manga.json`,
  `lightnovels.json`) que la web pide por `fetch` en tiempo de ejecución.
  Añadir una ficha no exige recompilar.
- **Panel**: Node.js 22, `http` de la biblioteca estándar, **sin dependencias**,
  interfaz en JavaScript sin framework.
- **Generador de borradores**: Python 3 estándar (`urllib`, `zipfile`), sin
  paquetes. Fuentes: AniList (GraphQL público), animethemes.moe (openings y
  endings), Ollama (modelo `qwen3.5:9b`, en otra máquina de casa) para traducir
  sinopsis y proponer la descripción corta.
- **Tests**: scripts propios de Node y un `unittest` de Python. Sin Jest ni
  Vitest. 783 comprobaciones. Se corren con `npm test`.

## 4. El modelo de datos

Cada fichero tiene `categories` (lista de cadenas) e `items` (lista de fichas).
Categorías reales:

| Sección | Categorías |
|---|---|
| anime | Visto, Viendo, No visto, Abandonado |
| manga | Leído, Leyendo, No leído, Abandonado |
| novelas | Leído, Leyendo, No leído, Abandonado |

Ficha de manga real (Chainsaw Man), con las opiniones abreviadas:

```json
{
  "id": 1,
  "title": "Chainsaw Man",
  "spanishTitle": "",
  "japaneseTitle": "チェンソーマン",
  "category": "Leído",
  "image": "covers/manga-1.jpg",
  "description": "Un joven que se fusiona con un demonio motosierra es reclutado…",
  "genres": ["Acción", "Gore", "Sobrenatural", "Comedia oscura"],
  "fullSynopsis": "Denji es un joven atrapado en la pobreza extrema…",
  "chapters": "Parte 1 finalizada (97 capítulos), Parte 2 en publicación",
  "volumes": "18+",
  "author": "Tatsuki Fujimoto",
  "hasAnime": true,
  "hasLightNovel": false,
  "related": {},
  "doIRecommend": "Obra maestra del shonen moderno. Locura absoluta.",
  "platforms": ["Manga Plus"],
  "languages": ["Español", "Inglés", "Japonés"],
  "rating": "9.5/10",
  "ratingFinal": "10/10",
  "personalOpinion": "Una locura de historia…",
  "personalOpinionFinal": "El final de la primera parte es cine puro…",
  "physicalStores": [{ "name": "Amazon", "languages": [{ "language": "Español", "volumes": [{ "name": "Tomo 1", "url": "…" }] }] }],
  "entries": [
    { "id": "e-3f9a1c2b", "date": "2026-09-01", "volume": 3, "chapter": 21, "rating": 9, "text": "…" }
  ],
  "anilistIds": [105778]
}
```

Notas sobre los campos:

- `title` es el título de **AniList** (inglés o romaji): es con el que se
  emparejan las fuentes. `spanishTitle` es el de la **edición española** («Un
  amor de tinta y espuma» para *The Summer You Were There*), opcional, se ve en
  la ficha, la tarjeta y el buscador.
- `rating` y `ratingFinal` son **cadenas** («9.5/10»); la nota de una entrada del
  diario es un **número** 0–10. No se mezclan.
- `chapters`, `volumes` y `episodes` son **texto** («2 temporadas/26»,
  «18+ (en publicación)»), no números: la web los pinta tal cual.
- `hasAnime` / `hasManga` / `hasLightNovel`: la obra existe en ese medio.
  Solo cuentan relaciones de AniList que son la **misma historia** en otro
  medio (adaptación, fuente, alternativa, obra madre), no spin-offs. Anime
  tiene `hasManga` y `hasLightNovel`; manga tiene `hasAnime` y `hasLightNovel`;
  novela tiene `hasAnime` y `hasManga`.
- `related`: `{ "manga": 1 }`, el id de la ficha **hermana** en otra sección.
  Vive en las dos fichas (la web solo carga una sección a la vez). Con él, el
  modal pinta «Ver el manga →»; sin él, «Sí, pero aún no lo he reseñado» o «No».
- `entries`: el **diario**, lista plana, solo se añade. Cada entrada lleva un
  localizador según la sección: anime `season` + `episode`, manga `volume` +
  `chapter`, novela solo `volume`. Una entrada sin localizador es una nota
  general. `date` la pone el panel; `id` también, para poder editarla.
- `image`: ruta propia `covers/<seccion>-<id>.<ext>`. La procedencia (URL
  original, fecha, bytes) está en `public/covers/origen.json`.
- `anilistIds`: ids de AniList de la franquicia (anime: varios, una por
  temporada) o de la obra (manga, novela: uno). Evita duplicados al publicar y
  cruza la bandeja de pendientes.
- `physicalStores`: tienda → idioma → tomos con enlace. Solo manga y novela.
- `openings` / `endings` (`[{ "name", "url" }]`, con «(Temporada N)» en el
  nombre) y `willReadSource`: solo anime.

Campos en el orden real de las claves por sección (lo escribe el panel):

- **anime**: id, title, spanishTitle, japaneseTitle, category, image,
  description, genres, fullSynopsis, episodes, hasManga, hasLightNovel,
  related, willReadSource, doIRecommend, platforms, languages, rating,
  ratingFinal, personalOpinion, personalOpinionFinal, openings, endings,
  entries, anilistIds.
- **manga**: id, title, spanishTitle, japaneseTitle, category, image,
  description, genres, fullSynopsis, chapters, volumes, author, hasAnime,
  hasLightNovel, related, doIRecommend, platforms, languages, rating,
  ratingFinal, personalOpinion, personalOpinionFinal, physicalStores, entries,
  anilistIds.
- **novela**: igual que manga pero sin chapters y con illustrator tras author,
  hasAnime y hasManga, y sin platforms.

Contenido real hoy: 8 animes, 1 manga (Chainsaw Man), 1 novela (Mushoku
Tensei). Y 32 borradores de anime, 28 de manga y 2 de novela esperando en el
panel.

## 5. Cómo está organizado el código

```
index.html                 plantilla (con las etiquetas Open Graph genéricas)
src/
  main.jsx, routes.jsx     arranque y rutas (/:seccion, /:seccion/:id)
  App.jsx                  cabecera, píldoras de sección, buscador, filtros por
                           categoría, «Sin opinar», ajustes, rejilla en cascada,
                           botón de tema, y el modal de la ficha abierta
  data/contentTypes.js     REGISTRO de secciones: slug de URL, fichero JSON,
                           textos y modal de cada una
  data/niveles.js          ESQUEMA: niveles del diario por sección, nombre y
                           género gramatical, hermanas posibles y su bandera
  data/normalize.js        normaliza los JSON (listas siempre listas, etc.)
  data/useContentData.js   fetch de los JSON con caché por sección
  components/
    ContentCard.jsx        la tarjeta: portada, nota, contador de diario,
                           título, título español, 2 líneas de sinopsis, 3 géneros
    AnimeModal.jsx         modal cristal
    MangaModal.jsx         modal viñeta (con submodal de tienda)
    LightNovelModal.jsx    modal libro (paginado con columnas CSS)
    EntriesBlock.jsx       el diario, con tres pieles (cristal, viñeta, libro)
    CoverImage.jsx         imagen con recuadro de «portada no disponible»
  lib/
    entries.js             normalizar y agrupar el diario por niveles
    related.js             las hermanas: tres estados a partir de related y hasX
    search.js              buscador sin tildes por título, títulos alternativos,
                           descripción, autor, géneros, plataformas, idiomas
    rating.js, opinionFields.js, storage.js, covers.js

public/data/*.json         los datos
public/covers/             las portadas (+ origen.json)
public/texturas/           la textura de papel del libro

panel/
  servidor.mjs             el servidor HTTP del panel (API + estáticos)
  empujar.mjs              lo que corre el timer en Pavilion: trae portadas
                           externas, hace fetch + rebase + push + verificación,
                           y respalda lo publicado en GitHub (origin/main → v2)
  generar.mjs              lo que corre carlos-opinion-generar.service: atiende
                           la cola de borradores pedidos desde el panel
  lib/secciones.mjs        mapa de secciones: fichero, campos de Carlos, orden
  lib/aplicar.mjs          operaciones sobre una ficha (puro): field.set,
                           entry.add, entry.edit, entry.remove
  lib/promover.mjs         publicar un borrador (puro): valida, asigna id,
                           rechaza opiniones y duplicados por anilistIds
  lib/hermanas.mjs         enlazar / desenlazar dos fichas (puro, simétrico)
  lib/clonar.mjs           crear la ficha hermana a partir de otra (puro)
  lib/revisar.mjs          el registro de «lo que propuso la máquina» (puro)
  lib/portadas.mjs         traer portadas externas a public/covers (IO inyectado)
  lib/pendientes.mjs       la bandeja de AniList (puro): episodios vistos sin
                           comentar
  lib/cola.mjs             pedir un borrador (puro): valida el pedido, lo
                           traduce a argumentos de generar.py, lee su salida
  lib/respaldo.mjs         la copia en GitHub (puro): cuándo se empuja y cuándo
                           se espera tras un fallo
  lib/repo.mjs             git: sincronizar, commitear, empujar, leer borradores,
                           empujar a otro remoto
  web/index.html, panel.js la interfaz (importa módulos compartidos con la web)
  revisar.json             lo pendiente de revisar tras publicar

generador/
  generar.py               borradores de anime (franquicia entera desde AniList
                           + animethemes + Ollama) y de manga/novela
  whakoom.py               importador de la colección de Whakoom (xlsx)
  test_whakoom.py
  coleccion/               (ignorado) la exportación de Whakoom, en el PC

scripts/
  deploy.mjs               publicar: push a casa y comprobar .deploy-ok
  og.mjs (+ lib/og.mjs)    tras el build, un HTML por sección y por ficha con
                           Open Graph, más sitemap.xml, feed.xml (RSS) y robots.txt
  portadas.mjs             traer portadas externas (lo usa también empujar.mjs)
  promote.mjs              publicar un borrador desde la línea de comandos
  captura.mjs              capturas reales de la web con Chrome headless (CDP)
  test-*.mjs               las 9 suites

deploy/
  docker-compose.yml       el nginx (imagen nginx:alpine, 64 MB, solo LAN :8098)
  nginx.conf               try_files $uri $uri.html $uri/ /index.html
  post-receive             hook del repo bare: build, guardas, rsync, .deploy-ok
  update                   hook: nadie reescribe main (force-push solo a borradores)
  panel/*.service, *.timer unidades systemd del panel y del publicador
  README.md, panel/README.md

docs/                      VERSION-2, esquema-ficha, panel-privado,
                           rediseno-fichas, integracion-jellyfin (los planes);
                           estado-v2 (auditoría), registro-2026-09-03 (diario)
CLAUDE.md                  instrucciones para una sesión con acceso al repo
```

Scripts de `package.json`: `dev`, `build` (= `vite build` + `og.mjs`),
`build:pages`, `lint`, `test`, `test:py`, `panel`, `portadas`, `deploy`,
`preview`.

## 6. La web, pieza a pieza

- **Cabecera**: título de la sección (pulsarlo vuelve al principio: sin filtro,
  sin búsqueda, sin ficha), tres píldoras Anime / Manga / Novelas siempre
  visibles, botón sol/luna para el tema, frase de presentación solo en
  escritorio, buscador, botones de categoría, «Sin opinar (n)» y un engranaje
  con animación elástica, orden (como se añadió, mejor nota, alfabético) y
  columnas (1–6, limitadas por el ancho real).
- **Rejilla en cascada**: cada portada a su altura natural (unas son carteles
  verticales, otras banners apaisados). Se probó una rejilla uniforme 2:3 y se
  descartó: a los banners les salían franjas enormes. Queda a un interruptor
  `UNIFORME` en `ContentCard.jsx`.
- **Tarjeta**: portada con insignia de nota (la final manda) y contador de notas
  del diario; título (2 líneas), título español, sinopsis (2 líneas), tres
  géneros y «+n».
- **Modal**: la URL cambia a `/anime/2`, el botón atrás cierra. Dentro: datos,
  hermanas, openings y endings (anime) o dónde leer y comprar (manga y novela),
  sinopsis, plataformas, idiomas, opiniones, y el diario plegado (desplegado en
  el libro, que pagina). En móvil las filas «etiqueta: valor» del cristal se
  apilan, la viñeta enseña la portada entera y la primera página del libro va
  llena.
- **Modo claro**: fondo con degradado tenue índigo → pizarra → morado, para que
  el cristal se lea como cristal. Modo oscuro: `#0f172a`.
- **Compartir**: cada ficha tiene su HTML con `og:title`, `og:description`,
  `og:image` (la portada) y `og:url`; WhatsApp, Telegram o Discord muestran la
  ficha. Para el navegador es la misma aplicación.

## 7. El panel privado

Un solo usuario. Dos modos: **local** (en el PC, `npm run panel`, escribe en el
árbol de trabajo y no hace commits) y **servidor** (en Pavilion, escucha solo en
la IP de LAN, exige un token largo, commitea cada cambio y **no empuja**: de eso
se encarga un timer cada dos minutos, para que escribir dos frases no cueste el
minuto que tarda el build).

Lo que hace:

- **Fichas**: por sección, con pins de nota, número de notas del diario, «sin
  opinar» y «revisar». Al abrir una: los campos de Carlos (categoría, título
  español, notas, opiniones), el bloque «La misma obra en otra sección» con un
  selector por hermana (y «Crear la ficha de manga a partir de ésta» si no
  hay), el diario con formulario de nueva entrada (los niveles se conservan
  entre entradas y el último sube solo), y el bloque «Revisa lo que propuso la
  máquina» si lo hay, con botón «Ya lo he revisado».
- **Borradores**: lo que dejó el generador en la rama `borradores` de git. Se
  ven con lo que encontró la máquina (según la sección), lo que le falta para
  poder publicarse, lo que hay que revisar, y un selector de categoría de esa
  sección. «Publicar ficha» la mete en el JSON con id nuevo. Nunca se publica
  dos veces la misma franquicia.
- **Pendientes**: pregunta a AniList (desde el navegador, no desde el servidor,
  que no tiene salida a internet a propósito) qué episodios ha visto y no ha
  comentado, y ofrece una fila por episodio con nota y texto. Jellyfin marca
  los episodios en AniList mediante el plugin Ani-Sync.
- **Pedir un borrador** (solo en Pavilion): en la vista de borradores, un
  formulario con sección, «título en AniList o su id» y título español, más
  «Buscar lo nuevo en Jellyfin» con un límite (3 por defecto, 10 como mucho).
  El panel no genera nada: escribe un pedido (`~/carlos-opinion/generar/cola/`)
  y una unidad `.path` de systemd arranca `panel/generar.mjs`, que mueve el
  pedido a `enmarcha/`, lanza `generar.py --a-borradores` (o `--pendientes
  --generar --limite N` con el anime.json publicado, leído del bare), deja el
  resultado en `hecho/` y avisa por ntfy. Si AniList devuelve varios
  candidatos, el resultado los enseña como botones y elegir uno es pedir por
  id. Un pedido sale de la cola antes de tocarlo, pase lo que pase: la unidad
  `.path` se vuelve a disparar mientras la cola no esté vacía. Lo que quedó en
  `enmarcha/` tras un corte se da por interrumpido; nunca se relanza solo.

API (todas bajo `/api`, cabecera `X-Panel-Token` en modo servidor): `GET
/secciones` (incluye `generar: true/false`), `GET /estado`, `GET /revisar`,
`GET /borradores`, `GET /borradores/:seccion/:id`, `POST
/borradores/:seccion/:id/promocionar`, `GET /generar` (cola, en marcha, últimos
resultados) y `POST /generar` (`{modo:'id'|'titulo'|'jellyfin', seccion,
anilistId|titulo, tituloEs?, limite?}`; el id del pedido lo pone el servidor),
`GET /:seccion`, `POST /:seccion/op` (field.set, entry.add, entry.edit,
entry.remove), `POST /:seccion/hermana`, `POST /:seccion/clonar`, `POST
/:seccion/revisar/:id/hecho`. Los módulos compartidos con la web se sirven bajo
`/m/`.

Escrituras atómicas (tmp + rename), anillo de 20 copias por sección antes de
cada escritura, un cambio cada vez (cola en serie), y en modo servidor un
`fetch` + `rebase` antes de cada operación para no trabajar con datos rancios.

## 8. El generador de borradores

`generar.py --seccion anime|manga|lightnovel --anilist-id N --a-borradores`
(o `--titulo "..."`, que si hay varios candidatos **para y los lista** en vez de
coger el primero a ciegas). Escribe `drafts/<seccion>/<id>.json` en la rama
`borradores`, que nunca se mezcla con `main` y no puede romper la web.

- **Anime**: una ficha es una **franquicia**. Desde un id recorre el grafo de
  relaciones de AniList (secuelas, precuelas, obra madre; películas y OVAs solo
  como historias laterales), cuenta episodios, junta géneros, recopila openings
  y endings de animethemes.moe anotados por temporada, verifica que cada enlace
  responda, y con Ollama traduce la sinopsis y propone la descripción corta.
  Calibrado contra las 8 fichas escritas a mano.
- **Manga y novela**: una obra es una obra (seguir el grafo arrastraría
  spin-offs). Capítulos y volúmenes como texto, autor e ilustrador con una
  heurística sobre el staff (marcados para revisar), banderas hasX.
- **`--titulo-es "..."`** pone el título de la edición española.
- Los campos de Carlos salen siempre vacíos. `_meta` lleva la fuente, los
  `anilistIds`, `_revisar` (campos dudosos) y `_avisos`; se quita al publicar y
  lo de revisar pasa a `panel/revisar.json`.
- Si Ollama falla, la sinopsis queda en inglés y la descripción son las dos
  primeras frases, y el borrador lo avisa. Si AniList falla, no se inventa nada.

Fuentes descartadas y por qué: **Crunchyroll** (sus condiciones prohíben el
acceso automatizado; el buzón viable es AniList vía Jellyfin), **TMDB** (nunca
hizo falta), **raspar Whakoom** (prohibido).

## 9. El importador de Whakoom

Whakoom es donde Carlos cataloga su colección física. Exporta un **xlsx** con
una fila por tomo: `Series` (título de la edición española), `Number`, `Title`
(subtítulo del tomo), `Publisher`, `Language`, `Release`, `Readed` (fecha en que
lo marcó leído) y `Url`. Su colección: 55 series, 384 tomos, 207 leídos.

`whakoom.py coleccion/whakoom.xlsx` corre **en el PC** (la colección no sale de
casa), lee el xlsx sin dependencias, agrupa los tomos en series, cuenta los
leídos y sugiere categoría (todo leído → Leído, a medias → Leyendo, nada → No
leído), descarta lo ya publicado y busca el resto en AniList. Decide:

- **Seguro**: un único candidato cuyo título coincide, contando los
  **sinónimos** de AniList (ahí están los títulos licenciados en español).
- **Dudoso**: varios, o ninguno coincide → lista con `--anilist-id` para elegir.
- **Sin resultado**.

Reglas aprendidas con los datos reales: un one-shot con varios tomos no es esa
obra; los sufijos de edición («- Volumen 2», «Edición Coleccionista», «Pack»)
se limpian y lo hallado así siempre es dudoso; si el título coincide con una
ficha de anime publicada, lo avisa (serán hermanas). Nunca crea un borrador de
un dudoso. Resultado hoy: 28 seguros (ya generados como borradores, con su
título español), 20 dudosos (sobre todo manga o novela con el mismo nombre:
*High School DxD*, *Los diarios de la boticaria*, *The Dangers in My Heart*, la
saga *Rascal*), 7 sin resultado.

## 10. La infraestructura

- **Pavilion** (`192.168.50.148` por cable, `192.168.50.28` por WiFi; hostname
  `carlospaviliondv6`): Debian 13, un HP dv6 viejo. Aloja el repo bare
  (`~/carlos-opinion/repo.git`), el clon de build, el nginx en Docker, el
  panel (cuatro unidades systemd: `carlos-opinion-panel.service`, el escritor,
  con límite de 96 MB y sin salida a internet; `carlos-opinion-push.timer`, el
  publicador, cada 2 min, sin límites porque corre el build; y
  `carlos-opinion-generar.path` + `.service`, que atienden los borradores
  pedidos desde el panel, con MemoryHigh 96M / MemoryMax 192M y 45 min de tope
  por pedido), el generador (copia manual en
  `~/carlos-opinion/generador/generador/`, no un checkout) y
  Nginx Proxy Manager (HTTPS, dominios `*.carlosin120fps.duckdns.org`, Access
  List para el panel), además del resto del homelab (Jellyfin, Matrix, ntopng,
  crowdsec, AdGuard…). Regla del nodo: nada escucha en `0.0.0.0`; todo servicio
  nuevo por debajo de 100 MB de RAM.
- **Strix** (`192.168.50.14`, `carlosscar17`): la máquina potente; corre Ollama
  (`:11434`), Jellyfin, Immich, etc.
- **El PC de Carlos** (Windows, `192.168.50.162`): desde donde se desarrolla.
  Remotos git: `casa` (Pavilion) y `github`
  (`CarlosIn120FPS/Carlos-Opinion`, rama `v2`; `main` de GitHub está antiguo).
- **La copia en GitHub también sale de Pavilion**: el timer del panel, haya o
  no algo que publicar, compara `origin/main` con `github/v2` (referencias
  locales, sin red) y si difieren empuja `origin/main` a `v2` con una clave de
  despliegue propia (`~/.ssh/carlos-opinion-github`, en `core.sshCommand` del
  clon `panel-work`, con `BatchMode` y `ConnectTimeout` porque el timer no
  tiene timeout). Nunca fuerza. Si falla (la clave sin registrar en GitHub,
  GitHub caído) apunta el fallo en `~/carlos-opinion/.github-fallo`, avisa por
  ntfy y no reintenta hasta pasadas 3 horas. Así lo escrito desde el móvil ya
  no vive solo en Pavilion.
- **Circuito de publicación**: `git push casa main` → hook `post-receive`
  (`npm ci` si cambió el lock, `npm run build`, guardas: index.html y los tres
  JSON válidos, `rsync --delay-updates` a `site/`, escribe `.deploy-ok` con la
  revisión). Como git ignora el código de salida del hook, `scripts/deploy.mjs`
  compara `.deploy-ok` con lo empujado y avisa. Un fallo manda un aviso por
  ntfy desde el propio hook (`fallo()` hace `curl` al tema `carlos-opinion`) y,
  si el push vino del panel, también desde `empujar.mjs`. Hook `update`:
  `main` no se puede reescribir. El build deja además `sitemap.xml`,
  `feed.xml` y `robots.txt` en la raíz de la web.
- **ntfy** (`192.168.50.148:8090`, público en `ntfy.carlosin120fps.duckdns.org`)
  es `deny-all`: hasta el 4-9-2026 ningún usuario tenía escritura en el tema
  `carlos-opinion`, así que **ningún aviso llegó nunca** (403 en silencio). El
  código ya manda `Authorization: Bearer $CO_PANEL_NTFY_TOKEN` si la variable
  está en `panel.env` (el hook lee ese fichero; las unidades lo cargan con
  `EnvironmentFile=`). Crear el usuario `carlos-opinion-bot` con escritura en
  el tema, su token, y `movil` con lectura, es cosa de Carlos
  (`deploy/panel/README.md` trae los comandos). No se abre el tema a anónimos:
  ntfy es público.
- **Incidente del 3-9-2026**: al actualizar Pavilion al kernel 6.12.105, su
  adaptador de red USB (ASIX AX88179B, en una controladora USB3 Renesas sin
  firmware) dejó de recibir tramas mayores de ~1500 bytes con la MTU a 9000:
  cualquier subida grande por cable se cortaba. Strix, con el mismo adaptador
  y kernel pero controladora Intel, no lo sufre. Decisión: Pavilion arranca
  siempre en 6.12.96 (`GRUB_DEFAULT` por id) y los paquetes del kernel están
  retenidos (`apt-mark hold`); lo demás se actualiza. Antes de probar otro
  kernel: `ping -f -l 2000 192.168.50.148` desde el PC. Parche de emergencia:
  `ip link set enx9c69d37d15ce mtu 1500`. Además OpenSSH 10 penaliza por IP las
  conexiones que mueren (`PerSourcePenalties`): tras varios cortes seguidos
  rechaza todo lo que venga del PC unos minutos; se entra por Strix
  (`ssh -J strix pavilion`) o por la WiFi.

## 11. Cómo se trabaja (las reglas de la casa)

- `npm test`, `npm run lint` y `npm run build` antes de cada commit, mirando el
  **código de salida**, no la última línea (se colaron dos errores de lint por
  filtrar la salida).
- Cada test nuevo se comprueba **reintroduciendo el fallo en local** y viendo
  que cae con el síntoma exacto. Nunca se reintroduce un fallo en Pavilion
  para verificar (costó un bloqueo de sshd y una MTU rota).
- Lo visual se mira **antes** de publicar, con capturas reales (escritorio y
  390 px, claro y oscuro), y se le enseña a Carlos el antes y el después. Lo
  que es gusto se le pregunta; lo que es defecto se arregla.
- Cada cambio en `panel/` exige rebase del clon del panel y reinicio del
  escritor; cada cambio en `nginx.conf` se copia a mano; cada cambio en
  `generar.py` se copia a la carpeta del generador. El deploy solo publica la
  web.
- Commits en español, con el porqué y con lo que salió mal contado entero.
- La lógica nueva va **pura** (sin disco, red ni reloj) en `panel/lib/` o
  `src/lib/`, y el servidor o el componente solo la llaman. Es lo que hace que
  todo se pueda probar desde Node sin levantar nada.

## 12. Estado y lo que queda

La auditoría del plan v2 está en 27 de 27. Hecho el 3-9-2026: fichas
hermanas, portadas locales, revisar tras publicar, Open Graph, clonar a manga,
importador de Whakoom calibrado, título español, rediseño (cabecera compacta,
fondo claro, tarjetas, modales en móvil, navegación y tema). Hecho el 4-9-2026:
copia en GitHub desde el timer de Pavilion, pedir borradores desde el panel,
aviso por ntfy en el hook, sitemap + feed RSS + robots.

En manos de Carlos:

- **Registrar la clave de despliegue de Pavilion en GitHub** (repositorio →
  Settings → Deploy keys → Add, con *Allow write access*; la clave pública
  está en `~/.ssh/carlos-opinion-github.pub` de Pavilion). Hasta entonces la
  copia falla y ntfy lo recuerda cada 3 horas.
- Publicar los 28 borradores de manga y los 2 de novela desde el panel,
  eligiendo categoría (el informe de Whakoom sugiere una por serie).
- Decidir los 20 dudosos y buscar a mano los 7 sin resultado de Whakoom.
- Enlazar el primer par de hermanas (Chainsaw Man manga ↔ anime, cuando publique
  el borrador del anime) y poner el título español a las 10 fichas antiguas.
- El `main` de GitHub: hoy el trabajo está en la rama `v2`.

Ideas que se descartaron o aparcaron: comentarios o votos de visitantes (una
nota media de desconocidos al lado de su 10/10 lo convierte en un MyAnimeList
peor), un timer nocturno para el generador (se añade ~1 anime al mes; el panel
ya enseña los borradores), rejilla uniforme de portadas.

## 13. Vocabulario

- **Ficha**: una obra en una sección. **Sección**: anime, manga o novela ligera
  (clave interna `lightnovel`; `novelas` es solo la URL).
- **Hermanas**: la misma obra en dos secciones, enlazadas con `related`.
- **Diario** (`entries`): sus notas por episodio o volumen. Distinto de
  `personalOpinion`, que es la opinión del conjunto.
- **Borrador**: ficha generada por la máquina, en la rama `borradores`, sin
  publicar. **Publicar / promocionar**: meterla en el JSON con categoría.
- **Revisar**: los campos que la máquina rellenó con menos certeza.
- **Pendientes**: episodios vistos (según AniList) sin comentar.
- **Casa**: el remoto git de Pavilion. **Pavilion / Strix**: las dos máquinas.
- **Cristal / viñeta / libro**: las tres pieles de los modales.
