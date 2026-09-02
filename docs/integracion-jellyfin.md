# Integración Jellyfin + Ollama, y funciones nuevas

> Plan producido en septiembre de 2026 por un análisis multiagente: exploración del
> código y de la infraestructura real (por ssh, midiendo, no suponiendo), tres diseños
> independientes de la integración puntuados por jueces con criterios distintos, y
> cuatro tandas de propuestas de funciones desde puntos de vista opuestos.
>
> Datos de infraestructura verificados a mano después: `qwen3.5:9b` existe (6,6 GB,
> 9,7B) y es el único modelo no-roleplay de los siete instalados; la RTX 2080 Super
> tiene 8 GB y Jellyfin responde en el 8096.

# Síntesis final — integración Jellyfin + Ollama para Carlos' Opinion

---

## 0. La cuenta honesta, antes de nada

Añades del orden de **1 anime al mes**. El generador te ahorra unos 20 minutos por ficha. Eso son ~4 horas al año contra 2-3 días de construcción: **por velocidad no amortiza nunca**.

Lo que sí justifica construirlo son otras dos cosas:

1. **El backfill.** Tienes ~30 series en Jellyfin y 8 fichas en la web. Ahí hay ~22 fichas que hoy no existen porque escribirlas a mano es un trabajo horrible (Alya sola son 13 entradas de opening/ending con canción, artista y episodio). Ese valor está disponible **hoy**, de golpe, y no depende de ningún timer.
2. **Consistencia.** El título en kanji, la lista completa de temas, `hasManga`/`hasLightNovel` correctos: campos que a mano se rellenan a medias o se dejan en blanco. La máquina los pone siempre.

Con ese marco, la pieza principal es **un comando que tú disparas**, no un demonio. El automatismo es un extra barato encima.

---

## 1. La recomendación

**Nombre: `generar.py`.** Un script Python de un disparo, stdlib pura (urllib, json, subprocess), que corre en Pavilion.

### Dónde corre cada pieza y por qué

| Pieza | Nodo | Por qué |
|---|---|---|
| `generar.py` + tokens + caché | **Pavilion** `~/carlos-opinion/generador/` | Es el nodo 24/7 y donde ya viven `repo.git`, el hook y nginx |
| Clon de trabajo `work/` | **Pavilion** | Para commitear a la rama de borradores sin tocar `build/` ni `site/` |
| Jellyfin :8096, Ollama :11434 | **Strix**, sin tocar nada | Se consultan por HTTP (2,2 ms y 10,4 ms medidos). Ni un servicio se mueve de nodo |
| Promoción y revisión | **Tu PC** | Es donde vive el juicio, y es deliberado |

Sobre la regla de los <100 MB: se cumple **literalmente**. No hay nada residente. El proceso pide ~40 MB, vive 30-60 s y muere. Aun así, `MemoryMax=192M` en la unidad (no 100M: `git receive-pack` cuenta dentro del mismo cgroup y un OOM-kill a mitad de la escritura es justo lo que no quieres en un nodo con el swap al 93%), `Nice=19`, `IOSchedulingClass=idle`, `TimeoutStartSec=600` y `timeout=` en **todas** las llamadas urllib. Sin ese último detalle, un Strix que se apaga a mitad de una petición deja la unidad colgada para siempre y el timer nunca vuelve a disparar.

### El flujo completo

```
[Tú añades una serie a Jellyfin]
        ↓
generar.py  (manual con --serie, o timer nocturno)
        ↓
  Jellyfin: ¿qué series hay? ¿cuáles NO están ya en la web?
        ↓
  AniList + TMDB + animethemes  →  todos los campos duros
        ↓
  Ollama (OPCIONAL): traducir sinopsis + redactar description
        ↓
  drafts/anime/<anilistId>.json   ← UN FICHERO POR ANIME
        ↓
  rama `borradores` (el hook la ignora, línea 26 verificada)
        ↓
[Tú]  git fetch casa  →  node promote.mjs <anilistId>
        ↓
  Rellenas category + nota + opinión en anime.json
        ↓
  git push casa main  →  el hook de siempre compila y publica
```

### Las cinco decisiones que corrigen los tres diseños

**(a) Un fichero por borrador, jamás parchear `anime.json` en la rama.**
Los tres diseños se rompían aquí, cada uno a su manera: uno destruía los borradores no mergeados con `push -f` sobre una rama reconstruida, otro daba `non-fast-forward` en cuanto quedaba un borrador pendiente, el tercero se atascaba en un `rebase` conflictivo sin ruta de recuperación. Todos por la misma causa: **el bot y tú escribís en las mismas líneas del mismo array**.

La solución elimina la clase entera de problema. Cada borrador es `drafts/anime/162804.json`. Y la rama es **derivada, no acumulativa**: cada ejecución hace

```
git fetch origin && git checkout -B borradores origin/main
git clean -fd && git reset --hard            # arranque siempre limpio
<escribe todos los borradores pendientes>
git commit && git push -f origin borradores
```

Como `main` **nunca** contiene `drafts/`, el conflicto es estructuralmente imposible, no "gestionado". Y como cada pasada reescribe la lista completa de pendientes desde cero, un `push -f` no puede perder nada.

**(b) La única fuente de verdad de "esto ya está hecho" es `anime.json` de `main`.**
Nada de `estado.json` ni de sqlite como segunda contabilidad: se pierde en un restore de restic, en un rebuild de Pavilion, y entonces el sistema o re-genera 30 fichas o marca como vistas cosas que nunca escribió. La regla es una línea: *¿el `anilistId` de esta serie aparece en el `anime.json` de main?* Si sí, no se genera. Si no, se genera.

Requisito previo, y es de los tuyos: **pegar a mano el `anilistId` en las 8 fichas actuales.** Diez minutos buscando en AniList. Nada de LLM desambiguando ocho títulos, eso era sobreingeniería.

El caché en disco (`cache/<id>.json`) sí se queda, pero es solo eso: caché. Si se borra, se vuelve a pedir y ya.

**(c) Ollama es un realce, no una dependencia.**
Es la mejor idea del diseño "robusto" y la que hace que el sistema siga sirviendo cuando Strix esté apagado. El 90% del valor (título en kanji, temas, episodios, hasManga, sinopsis en español de TMDB) viene de APIs públicas que no tocan Strix para nada. Si Ollama no responde: el borrador **sale igual**, `fullSynopsis` se queda con el inglés de AniList marcado `_review`, y `description` cae a las dos primeras frases cortadas por el punto. Determinista.

El LLM toca **exactamente dos campos**, y siempre para transformar un texto que ya se le da, nunca para "saber cosas":
- `fullSynopsis`: traducir al español **solo si** TMDB no tiene es-ES / es-MX / es-419.
- `description`: resumir en una o dos frases.

Modelo: `qwen3.5:9b` y solo ese (los otros seis son *uncensored* de roleplay). `think:false`, `format:` con esquema JSON, `num_ctx:4096` (con 8192 quedan 1,3 GB de VRAM libres y la GPU la comparte Jellyfin; con 4096 quedan ~2,5 GB de colchón). Verifica el tag exacto con `ollama list` antes de escribir el prompt.

**Los géneros NO pasan por el LLM.** Una tabla estática de 20 líneas: los 19 géneros cerrados de AniList más los `tags` con `rank>=60` (`School`→Escolar, `Isekai`→Isekai, `Harem`→Harem, `Gore`→Gore). Así es imposible que aparezca un género fuera de tus 15, sin depender de que un modelo obedezca.

**(d) El agujero que ningún diseño resolvió: las series multitemporada.**
Miré tus 8 fichas: **5 anotan los temas como "(Temporada 1)", "(Temporada 2)"**, y solo Alya usa "(Ep N)". Los tres diseños proponían `animethemes?filter[external_id]=<anilistid>` con el id que Jellyfin guarda — que es **el de la temporada 1**. Resultado: High School DxD (4 temporadas, 9 temas en tu ficha) saldría con los temas de la temporada 1 y con la anotación equivocada.

Arreglo: recorrer la cadena `SEQUEL` de `relations` en AniList desde el id base, consultar animethemes **una vez por temporada**, y anotar `"(Temporada N)"`. Lo mismo para `episodes`: TMDB da la obra completa, y las películas se cuentan mirando los nodos `MOVIE` del grafo de relaciones — marcado `_review`, porque tu formato libre ("+ 1 película anunciada para 2026") dice más que cualquier número.

**(e) La `url` de cada tema NUNCA se deja vacía.**
Verificado: `AnimeModal.jsx` pinta `<a href={track.url}>` sin ninguna guarda. Un `url:""` produce un botón clicable que navega a la nada — 13 de ellos en una ficha tipo Alya. El generador escribe siempre una URL de búsqueda de YouTube (`youtube.com/results?search_query=...`), que es exactamente el patrón que **ya usas** en las fichas 1 y 6. Tú lo cambias por el enlace directo cuando te apetezca.

### Qué rellena la máquina y qué escribes tú

**Columna 1 — determinista, sin IA:**

| Campo | Fuente |
|---|---|
| `title` | `Name` de Jellyfin |
| `japaneseTitle` | AniList `title.romaji (title.native)`. El `OriginalTitle` de Jellyfin **no sirve**: es romaji sin kanji |
| `image` | Portada descargada a `public/covers/<anilistId>.jpg` |
| `genres` | Tabla estática AniList → tus 15 |
| `episodes` | TMDB obra completa + películas del grafo. **Marcado para revisar** |
| `hasManga` / `hasLightNovel` | AniList `source` + `relations[].node.format`. Determinista *a propósito*: el modal pinta "No" ante un campo ausente, así que un booleano dudoso miente en la web |
| `openings` / `endings` | animethemes, **por temporada**, con URL de búsqueda |
| `anilistId` / `jellyfinId` / `tmdbId` | Idempotencia. Invisibles: `normalizeItem` hace `...raw` y ningún componente los lee |

**Columna 2 — LLM, y solo esto:** `fullSynopsis` (traducción, si TMDB no la tiene) y `description`.

Aviso honesto sobre `description`: la tuya de Alya ("*murmura cosas dulces en ruso creyendo que su compañero no la entiende, pero él domina el idioma a la perfección*") no es un resumen neutro, es un gancho editorial. Es la primera frase que lee cualquiera de cada tarjeta. Mi recomendación: **la máquina te la deja escrita para que no partas de una página en blanco, pero reescríbela tú.** Si a partir de la ficha 11 todas las descripciones las escribe un 9B imitándote, la voz de la web deja de ser tuya sin que nadie lo haya decidido.

**Columna 3 — tuyo siempre, sin excepción:**
`category`, `rating`, `ratingFinal`, `personalOpinion`, `personalOpinionFinal`, `doIRecommend`, `willReadSource`.

Salen como cadena vacía. Es literalmente el molde que ya existe: la ficha 8 (Alya) tiene todos los datos objetivos y esos seis campos en `""`.

Dos campos más que **la máquina no debe rellenar**, aunque técnicamente pueda:
- **`languages`**: sacarlo de los `MediaStreams` de Jellyfin describe las pistas de audio de tus rips, no dónde se puede ver. Tu ficha de Alya pone "Ruso" (que es diálogo de la serie) y la de My Dress Up Darling pone siete idiomas (que son los doblajes de Crunchyroll). **Un campo plausible y equivocado cuesta más revisarlo que uno vacío.** Se deja en blanco.
- **`platforms`**: TMDB `/watch/providers` ES da la lista limpia y se propone en `_review`, pero **no se escribe en el campo**. Lo tuyo es prosa con opinión ("Cualquier plataforma pirata.", "No, no puedes ver legalmente 1 de las películas"), y eso TMDB no lo va a decir jamás.

### La promoción, en tu PC

```bash
git fetch casa
node scripts/promote.mjs 162804
```

El script lee el borrador con `git show casa/borradores:drafts/anime/162804.json` — **no** hace `checkout` de `drafts/`, para que no te quede ese directorio en el índice de main esperando a que un `git add .` distraído lo suba a GitHub. Después: valida el esquema, comprueba que el `anilistId` no está ya en `anime.json` (si lo está, se niega y avisa: idempotencia real), calcula `id = max+1` **numérico** (obligatorio, `App.jsx` ordena con `a.id - b.id`), borra el bloque `_review`, y escribe con `tmp + rename`.

Y una regla que sustituye a todo el debate de las tres propuestas sobre qué poner en `category`: **el script se niega a insertar la ficha si no le pasas la categoría.** No hay "No visto" provisional que mienta, ni categoría vacía que haga desaparecer la tarjeta en silencio. La ficha no entra en `anime.json` hasta que tú has dicho en qué estado está. Es una decisión tuya, y es la primera que tomas.

### Aviso: sí hay que tocar `src/`

Los tres diseños presumían de "cero cambios en `src/`". Es falso, y son tres arreglos de dos líneas que **ya hacen falta hoy**:

1. **`CoverImage.jsx`**: si `src` no empieza por `http`, anteponerle `import.meta.env.BASE_URL`. Sin esto, las portadas locales dan 404 en `npm run build:pages` (`--base=/Carlos-Opinion/`). Verificado: hoy pasa `src` crudo al `<img>`.
2. **`AnimeModal.jsx` líneas 110-118**: `willReadSource` y `doIRecommend` se pintan **siempre**, así que hoy la ficha de Alya enseña "¿Voy a leer alguno de ellos?" seguido de nada. Con el generador eso pasa de ser un defecto en 1 ficha a serlo en 22. Que pasen por la misma guarda que ya usan la nota y la opinión en `opinionFields.js`.
3. **Guarda de `href` vacío** en los botones de opening/ending (cinturón, además de los tirantes de la URL de búsqueda).

---

## 2. Plan por fases

**Fase 0 — desbloquear (una tarde, casi todo tuyo).**
- Crear API key de Jellyfin (Panel → Avanzado → API Keys) y registrarte gratis en TMDB.
- **Confirmar la premisa**: ¿"colección" es la carpeta de la serie con todas sus temporadas, o son las BoxSets? El informe dice que las 7 BoxSets que existen son sagas (Fate, Re:Zero, Aobuta, Super Mario) creadas por el plugin TMDb, y que ninguna contiene una Serie. Pero *esas sagas son exactamente tu patrón de una ficha por franquicia*. Por defecto voy con la Serie y colapso a BoxSet si la serie pertenece a una — pero esto lo decides tú en una frase.
- Pegar los 8 `anilistId` a mano.
- Los tres arreglos de `src/`.

**Fase 1 — el núcleo, y aquí ya hay valor de verdad (2-3 tardes).**
`generar.py --serie <id> --dry-run`: clientes de Jellyfin, AniList, TMDB y animethemes, la tabla de géneros, la cadena de temporadas, y el borrador impreso por pantalla. **Sin Ollama, sin git, sin timer, sin estado.**

Y aquí, no al final, va la calibración: pásalo sobre las 8 series que ya tienes escritas a mano y compara campo a campo contra lo que escribiste tú. Es la única forma de saber si la tabla de géneros y el formato de los temas están bien, y es lo primero que se salta si se deja para el final. (Los jueces coincidieron: la estimación de "medio día" de la propuesta ganadora es optimista por 2-3×.)

Al acabar esta fase ya puedes hacer el backfill de las 22 series, que es el 90% del valor disponible hoy.

**Fase 2 — realce y transporte (medio día).**
Cliente de Ollama con esquema JSON y sus caídas deterministas. Escritura de `drafts/*.json` a la rama `borradores` con el ciclo derivado. `promote.mjs`.

**Fase 3 — automatismo (medio día).**
Unidad y timer de systemd, **diario, de madrugada**, no cada 15 minutos ni cada hora. El informe desmiente el uptime de 5,2 h (rachas reales de 14 y 25 días) y sobre todo: 2.900 sondeos al mes para 1 acierto es maquinaria que solo sirve para romperse. Un timer nocturno da el mismo valor y esquiva de paso cualquier contención de VRAM con Jellyfin.

Aviso: si vas a usar el `--serie` a mano mientras el timer existe, hace falta `flock` — comparten el mismo `work/`.

**Fase 3b — que te enteres.** Un `drafts/PENDIENTES.md` **commiteado dentro de la rama**, con la fecha de la última ejecución. Así el aviso viaja con los datos y lo ves con `git fetch casa && git log casa/borradores`. Los seis jueces coincidieron en esto: un `pendientes.md` en `/home/carlosalexei/` de Pavilion y una línea en `journalctl` son un buzón que nadie visita, y a los seis meses no puedes distinguir "no he añadido nada" de "lleva cinco meses roto". Si algún día montas ntfy, es una línea de `curl` al final.

**Lo que se queda fuera para siempre:** detección de temporadas nuevas sobre fichas ya publicadas. Es una idea buena (mantener el `episodes` de Kaguya al día) pero en los tres diseños dependía de un estado que nadie escribía nunca. Si algún día la quieres, la forma correcta es un chequeo aparte que **reporta** ("tu ficha dice 3 temporadas, Jellyfin tiene 4") y no edita nada.

---

## 3. Funciones que merecen la pena

### Bajo esfuerzo — hazlas ya, varias son prerequisito del generador

1. **Etiquetas huérfanas de `willReadSource` y `doIRecommend`.** Ya explicado. Dos líneas, y con 22 fichas nuevas entrando pasa de detalle a bochorno.
2. **El buscador que busque algo más que `title`.** Hoy `App.jsx:110` filtra solo por `item.title`, así que "Yofukashi", "Aobuta", "青ブタ" o "Seishun Buta Yarou" devuelven cero. Y tu ficha 3 se titula literalmente *"Rascal Does Not Dream of... (muchas variantes)"*: a esa ficha hoy se llega de casualidad. Que mire también `japaneseTitle`, `genres` y `description`. **Salió en 3 de las 4 tandas de propuestas.**
3. **Portadas locales en `public/covers/`.** Tus 8 portadas apuntan a Crunchyroll, Netflix, wikia, JustWatch, Amazon y MyAnimeList, y `CoverImage.jsx` ya admite en un comentario que esas URLs llevan tokens que rotan. Cuando una caduca no te enteras, porque el placeholder gris lo disimula educadamente. El generador va a tener que hacer esto de todas formas (enlazar a Strix es imposible: no está expuesto y se apaga), así que mejor que web y generador hablen el mismo idioma desde el primer día.
   *Corrección a una de las propuestas*: **no** impongas una relación de aspecto fija. Se afirmaba que "las 8 portadas son 1200x675 apaisadas": es falso, hay al menos cuatro pósteres verticales (JustWatch, dos de MAL, uno de IMDb). La rejilla ya es de proporciones mezcladas y `h-auto` lo tolera.
4. **La nota en la tarjeta + orden "por nota".** Salió en 2 de 4 tandas y es el argumento más fuerte del lote: la web se llama *Carlos' Opinion* y su pantalla principal no enseña ni una opinión. La nota vive solo dentro del modal, y el orden de la rejilla es `a.id - b.id`, o sea el orden en que las creaste — un artefacto interno. Bonus gratis con tus datos: **7 de 7 pares suben al terminar** (8.5→10, 9→10, 9.1→9.3...). Ese salto es autorretrato, ningún catálogo lo tiene.
5. **Navegación de secciones visible.** Hoy la única puerta a `/manga` y `/novelas` es pulsar el H1, y la pista es `opacity-0 group-hover:opacity-100`: en móvil **no se muestra jamás**. Dos tercios de tu web son invisibles para quien entra desde un enlace de WhatsApp.
6. **Filtro e insignia "sin opinar".** Derivado, sin campos nuevos: las seis casillas de juicio vacías a la vez. Hoy `personalOpinionFinal` está vacío en 8 de 8 y `personalOpinion` en 4 de 8, y una ficha a medias se ve **exactamente igual de terminada** que una completa porque `tristate()` esconde los bloques vacíos.
   **Esto es el visor de la salida del generador.** Sin ello, cada ficha que produzca la máquina entra en la web indistinguible de una escrita por ti. Con ello, entran a una bandeja visible de "esto espera a que yo escriba". Es lo que convierte el generador en un ayudante en vez de en una fuente de fichas zombi. También arregla algo que ya chirría: el botón de filtro "No visto" está siempre ahí y **no tiene ni una ficha detrás**.

### Esfuerzo medio — merecen la pena, en este orden

7. **Enlazar `hasManga` / `hasLightNovel` a la ficha del otro lado.** Con un campo explícito (`"related": {"manga": 1}`), nunca adivinando por título. Es la única propuesta que salió en **las 4 tandas**. Hoy el modal te afirma "Tiene manga: Sí" y no te lleva a ninguna parte, ni siquiera cuando la ficha del manga existe. Y hay un campo pidiéndolo a gritos: `willReadSource` es literalmente tú prometiendo "estoy leyéndome el manga" sin ningún sitio adonde ir. De paso arregla que `item.hasManga ? 'Sí' : 'No'` pinte "No" tanto si es falso como si el campo falta: con tres estados ("Ver el manga →" / "Sí, pero aún no lo he reseñado" / "No") deja de mentir por omisión.
8. **Editor local de fichas** (`/editor`, solo bajo `import.meta.env.DEV`, con un middleware de Vite que escriba el JSON). El síntoma está en los datos: anime tiene 8 fichas, manga y novelas tienen **una cada una**, y la de Chainsaw Man tiene `physicalStores` con cuatro niveles de anidamiento. Eso a mano no lo hace nadie dos veces. Sinergia: es la interfaz natural para "importar borrador" — el `promote.mjs` deja de ser un comando con un número que hay que recordar y pasa a ser un botón. Y el botón "clonar a manga" (copia los 14 campos comunes y escribe los dos enlaces cruzados) es lo que hace que la sección de manga deje de tener una ficha.
9. **Vista previa al compartir (OG tags por ficha).** Un script postbuild que escriba un `index.html` por ruta con su `og:title`/`og:description`/`og:image`. Hoy `index.html:17-19` tiene el TODO abierto y **todas** las URLs comparten el mismo título genérico sin imagen: cuando compartes `/anime/2` por WhatsApp llega un rectángulo gris. Salió en 2 de 4 tandas. Barato y es lo primero que ve alguien que llega por un enlace tuyo.
10. **Diario de la ficha** (`notes: [{date, text}]`, append-only, nunca reescribe). Este merece un párrafo aparte, porque **es la única propuesta que ataca tu cuello de botella real**. El generador arregla la transcripción; el dato duro es que `personalOpinionFinal` está vacío en 8 de 8. No es que no tengas opinión: es que "escribe tu veredicto definitivo" da pereza y se pospone para siempre, mientras que "acabo de ver el episodio 7 y esto ha sido una salvajada" se escribe en diez segundos. Y resuelve un hueco real: los animes en "Viendo" no tienen dónde poner lo que vas pensando sin comprometerte a un veredicto. Cuando termines la serie, no partes de una página en blanco: partes de tus doce notas. **Regla que no se negocia: aquí la IA no escribe nunca, ni una nota ni un resumen de las notas.**

### Aparcadas, no descartadas

- **Trampa de foco en los modales + `prefers-reduced-motion`.** Correcto y barato, pero es corrección de accesibilidad, no funcionalidad. Cuando tengas un rato.
- **Categoría y búsqueda en la URL (`useSearchParams`).** Bien visto, pero con 8-30 fichas el filtro se rehace en dos clics.
- **Géneros clicables.** Con 8 fichas y 15 géneros apenas aporta; a partir de 30 sí.
- **Página `/perfil` con estadísticas.** Idea bonita (tu media ronda el 9, 6 de 8 animes llevan "Romance", jamás has bajado una nota al terminar) y mejora sola según crece la colección. Pero es adorno hasta que haya masa: espera a tener 30 fichas.
- **"Escuchar todos" los OP/ED como lista.** Buena observación —13 enlaces en fila es la peor presentación del mejor contenido de la web—, pero YouTube no deja construir una playlist desde URLs sueltas sin cuenta. Aparcada por fricción técnica, no por mala idea.

---

## 4. Lo que NO recomiendo hacer

**Comentarios, votos o notas de los visitantes.** Es lo primero que se le ocurre a todo el mundo y es lo que más daño haría. Técnicamente: no hay backend, el contenedor es `read_only: true`, el `rsync -a --delete` del hook borra en cada push cualquier cosa de `site/` que no venga del repo, y Pavilion tiene 438 MiB libres con el swap al 93%. Un servicio de comentarios no es un script efímero, es un demonio residente — exactamente lo que la regla de los <100 MB prohíbe. Pero la razón de fondo no es técnica: el valor entero de esta web es que hay **una** voz con criterio. Una nota media de desconocidos al lado de tu 10/10 a Call of the Night convierte esto en un MyAnimeList peor. Si quieres contacto, un "escríbeme" en el pie cuesta cero.

**Recomendador "si te gustó esto, te gustará aquello" con Ollama.** Es la tentación evidente teniendo el modelo a 10 ms. Y choca de frente con la regla central: **recomendar es opinar.** Tu `doIRecommend` dice cosas como "Hell yeah. Must watch." o "Si te gustan las matemáticas, vas a flipar, porque trata del enlazamiento cuántico". Eso no lo escribe un 9B; y si lo escribe, el lector deja de poder fiarse de **ninguna** frase de la web, porque ya no sabe cuáles son tuyas. Se carga el activo entero, no solo ese bloque. La versión buena de este impulso es la función 7: enlazar entre sí lo que tú ya has opinado.

**Un panel de administración en producción.** Mismo argumento del `read_only` y el `rsync --delete`: las fichas creadas desde el panel desaparecerían en el siguiente push, sin aviso. Más un backend con auth expuesto a internet en el nodo con 438 MiB libres. En local no hay auth que escribir, no hay superficie expuesta, y el commit te da historial y `git revert` gratis.

**Publicar automáticamente a `main`.** Verificado: el hook ignora cualquier ref que no sea `refs/heads/main`, y esa es la propiedad que hace que **nada de esto pueda romper la web**. Pase lo que pase con el generador, `https://opinion.carlosin120fps.duckdns.org` sigue sirviendo lo último que publicaste tú. No la toques. Además, si el bot escribiera en main, tu siguiente `git push casa main` saldría rechazado por non-fast-forward.

**Instalar el plugin Webhook de Jellyfin.** Su cola es un diccionario en memoria que se vacía cada 30 s (se pierde en cada reinicio de Strix), y `WebhookSender.NotifyOnItem` ni siquiera contempla `BoxSet`. El WebSocket sí ve las colecciones pero exige una conexión persistente contra un portátil que se apaga, y no bufferea. El sondeo es inmune a todo eso: si Strix estuvo caído tres días, la siguiente pasada lo recoge igual.

**Sondear cada 15 minutos, o cada hora.** 2.900 ejecuciones al mes para ~1 acierto. Toda la maquinaria de estado que eso obliga a mantener es la fuente de la mitad de los bugs que encontraron los jueces. Diario, de noche.

**Que el LLM toque géneros, booleanos, números, fechas o notas.** Un género inventado ensucia el vocabulario para siempre; un `hasManga` equivocado se pinta como una afirmación ("No"), no como un "no lo sé". La tabla estática es más corta que el prompt.

**El `CommunityRating` de Jellyfin como `rating`.** Es la nota de AniDB. Es el número que está ahí, parece una nota, y no es la tuya. Ni siquiera como sugerencia.

**Jikan / MyAnimeList como fuente.** Devolvió 504 en casi todos los endpoints no cacheados. Autohospedar Jikan v4 exige PHP-FPM + Redis + MongoDB, muy por encima de los 100 MB de Pavilion, y mover carga a Strix está prohibido. AniList + TMDB + animethemes cubren todo lo que hace falta.

**Backfill de los 8 `anilistId` con LLM.** Diez minutos a mano. Una de las propuestas le dedicaba medio día y lo ponía en la ruta crítica.

**Rellenar `languages` desde los `MediaStreams`.** Ya explicado: es el campo donde la máquina va a escribir algo que parece correcto y no lo es, y eso cuesta más revisión que un hueco.

---

### Las dos preguntas que hay que cerrar antes de escribir código

1. **¿Qué es "una colección" para ti?** ¿La carpeta de la serie con todas sus temporadas dentro (como Kaguya con Season 0-4), o las BoxSets tipo "青春ブタ野郎シリーズ"? El código es casi el mismo, pero el disparador cambia y no quiero adivinarlo.
2. **¿`ollama list` devuelve exactamente `qwen3.5:9b`?** Todo el presupuesto de VRAM (5,6 GB de 8) descansa sobre ese tag.
---

## Anexo — resuelta la pregunta 1: qué es "una colección"

**Respuesta de Carlos (septiembre de 2026):** la unidad es la **franquicia entera**.
Aunque en Jellyfin *Las Quintillizas* estén partidas entre la serie (en Series) y la
película (en Movies), en la web eso es **UNA sola ficha**: "Las Quintillizas".

Esto no es una preferencia nueva, es lo que ya hacen los datos actuales:

| Ficha | `episodes` |
|---|---|
| Rascal Does Not Dream of... (muchas variantes) | `2 temporadas/26 episodios + 3 películas + 1 película anunciada para 2026` |
| High School DxD | `4 temporadas / 49 episodios + OVAs` |
| Rent-a-Girlfriend | `5 temporadas/50 episodios` |

Y los temas se anotan por temporada: Rent-a-Girlfriend tiene 11, DxD 9, Aobuta 6.
(Alya es la excepción y va por episodio, porque esa serie cambia de ED cada capítulo.)

### Qué cambia en el diseño

1. **El disparador NO puede ser la BoxSet de Jellyfin.** Las 7 BoxSets existentes las
   creó el plugin de TMDb y solo agrupan películas: ninguna contiene una Serie. No
   sirven para juntar la serie con su peli.

2. **La franquicia se deriva del grafo de relaciones de AniList**, no de cómo esté
   organizado Jellyfin. Desde cualquier entrada se recorren `SEQUEL`, `PREQUEL`,
   `SIDE_STORY` y los nodos `MOVIE` hasta cerrar el conjunto, y ese conjunto es la
   ficha. Es la misma cadena que ya hacía falta para los temas por temporada, solo que
   ahora también define la unidad.

3. **La idempotencia cambia de clave.** Ya NO es "¿aparece este `anilistId` en
   `anime.json`?", sino **"¿aparece en `anime.json` algún `anilistId` de esta
   franquicia?"**. Por eso conviene guardar en la ficha el conjunto completo
   (`anilistIds: [...]`) y no un solo id.

4. **Consecuencia directa y deseable:** añadir a Jellyfin la temporada 2 de algo que ya
   está en la web **no genera nada**. Solo las franquicias nuevas producen borrador.
   Si algún día quieres enterarte de que una ficha se ha quedado corta ("tu ficha dice
   3 temporadas, Jellyfin tiene 4"), eso es un chequeo aparte que **reporta y no edita**.
