# Generador de borradores de ficha

Genera el esqueleto de una ficha de **anime, manga o novela ligera** a partir de
fuentes públicas, para no
tener que transcribir a mano títulos japoneses, géneros, episodios y las listas de
openings y endings.

**Nunca escribe tu opinión.** `category`, `rating`, `ratingFinal`,
`personalOpinion`, `personalOpinionFinal`, `doIRecommend` y `willReadSource` salen
siempre vacíos. Esos son tuyos.

## Estado

| | |
|---|---|
| Fuentes | AniList (grafo, títulos, géneros, sinopsis) y animethemes.moe (temas) |
| Claves necesarias | **ninguna**, las dos son públicas |
| Ollama | **sí** — traduce la sinopsis y propone la descripción corta |
| Verificación de enlaces | **sí** — ninguno se publica sin comprobar que responde |
| Jellyfin | todavía no (fase 3) — de momento se le dice qué anime generar |
| Escribe en git | **sí**, a la rama `borradores` con `--a-borradores` |

## Uso

```bash
# imprime el borrador por pantalla
python3 generar.py --titulo "Alya Sometimes Hides Her Feelings in Russian"

# lo publica en la rama `borradores` para revisarlo desde tu PC
python3 generar.py --titulo "Go-Toubun no Hanayome" --a-borradores

python3 generar.py --anilist-id 162804
python3 generar.py --anilist-id 162804 --sin-temas               # más rápido
python3 generar.py --anilist-id 162804 --sin-ollama --sin-verificar

# comparar contra lo que ya escribiste a mano
python3 generar.py --calibrar ../public/data/anime.json
python3 generar.py --calibrar ../public/data/anime.json --solo 8
```

Vive en Pavilion, en `~/carlos-opinion/generador/`.

## Manga y novelas ligeras

```bash
# el título es ambiguo a propósito: lista los candidatos y para
./generar.py --seccion lightnovel --titulo "Mushoku Tensei"

# con el id ya elegido
./generar.py --seccion manga      --anilist-id 105778 --sin-ollama
./generar.py --seccion lightnovel --anilist-id 85470  --a-borradores

# y se promociona igual que el anime, diciendo la sección
node scripts/promote.mjs 105778 --seccion manga --categoria "Leyendo"
```

Van por otro camino que el anime, y no por capricho:

- **Una obra es una obra, no una franquicia.** En anime la unidad es la
  franquicia entera porque las temporadas se numeran solas. En manga, seguir el
  grafo de relaciones rompe las dos fichas reales: la novela de Mushoku Tensei
  (85470, 26 volúmenes, que es justo lo que Carlos escribió) arrastra por
  `PARENT` el *Dasoku-hen* de 4 volúmenes y el *Recollection* de 1.
- **No hay respaldo.** animethemes.moe indexa anime y sus temas musicales; no
  conoce ids de manga. Si AniList no responde, esto falla en vez de inventarse la
  ficha con la mitad de los campos.
- **Sin openings ni endings**, y por tanto sin verificación de enlaces: no hay
  enlaces que verificar.
- **`chapters` y `volumes` son TEXTO**, no números: `"24 (finalizada)"`,
  `"18+ (en publicación)"`. La web los interpola crudos (`MangaModal.jsx` pinta
  `{item.chapters}`), y un número pelado diría *232* sin decir si se acabó, que
  es lo que de verdad quieres saber.
- **`willReadSource` no se emite.** Sólo existe en anime: lo tienen las 8 fichas
  de anime y 0 de manga y novelas. Los campos de Carlos por sección espejan
  `panel/lib/secciones.mjs`.

### La búsqueda por título PARA si hay varios candidatos

Coger el primero a ciegas genera la ficha equivocada sin avisar. Comprobado:
buscar «Mushoku Tensei» devuelve primero el spin-off *Dasoku-hen*, no la obra
que Carlos tiene escrita. Con más de un resultado se listan y se elige a mano.

### Qué tal acierta, calibrado contra las dos fichas escritas a mano

| Campo | Chainsaw Man (manga) | Mushoku Tensei (novela) |
|---|---|---|
| `title` | exacto | exacto |
| `author` | exacto | exacto |
| `hasAnime` / `hasManga` | exacto | exacto |
| `volumes` | AniList dice 24, Carlos escribió «18+» | «26 (finalizada)» vs «26 (Finalizada)» |
| `chapters` | AniList cuenta 232 seguidos; Carlos separa Parte 1 y 2 | — |
| `illustrator` | — | *Sirotaka* vs *Shirotaka* (romanización) |
| `genres` | 6, los 4 suyos entre ellos | 6, los 5 suyos entre ellos |

Las diferencias reales son de criterio, no errores, y **todas salen marcadas en
`_revisar`**: cómo contar los capítulos de una obra partida en dos partes es una
decisión suya, no un dato.

## Whakoom: la colección de manga y novelas

Whakoom no tiene API y raspar su web está prohibido por sus condiciones. Lo que
sí hay es la **exportación manual** de la colección (cuenta PRO), que sale como
xlsx. `whakoom.py` corre **en tu PC**, no en Pavilion: tu colección es un dato
personal y se queda en casa. El fichero va en `generador/work/` (en
`.gitignore`).

```bash
python3 whakoom.py work/whakoom.xlsx                # emparejar e informar
python3 whakoom.py work/whakoom.xlsx --generar      # y borradores de los SEGUROS
python3 whakoom.py work/whakoom.xlsx --columnas serie=Serie,numero=Número
```

Lee el xlsx sin dependencias (es un zip con XML), detecta las columnas por el
nombre de la cabecera, agrupa los tomos en series, descarta las que ya están en
la web y busca el resto en AniList (con caché).

Calibrado con la exportación real (2026-09-03: 55 series, 384 tomos). Lo que
trae Whakoom: `Series` (el título de la **edición española**), `Number`,
`Title` (subtítulo del tomo, no de la serie), `Publisher`, `Language`,
`Release`, `Readed` (la fecha en que lo marcaste leído) y `Url`. Con eso:

- **Por dónde vas**: tomos leídos y el último, y una categoría *sugerida* por
  serie (todo leído → Leído, a medias → Leyendo, nada → No leído). La
  categoría de verdad la eliges al publicar.
- **Títulos en español**: AniList guarda los títulos licenciados como
  *sinónimos*; si el de Whakoom está entre ellos, la coincidencia cuenta. Pasó
  de 12 seguros a 28 solo con eso.
- Un ONE_SHOT con más de un tomo no es esa obra: se descarta.
- Sufijos de edición («- Volumen 2», «Edición Coleccionista», «Pack …») se
  quitan antes de buscar; lo encontrado así es siempre dudoso.
- Si el título coincide con una ficha de anime publicada, lo dice: será su
  hermana al publicarla.

El informe tiene cuatro cajas:

| | |
|---|---|
| **Ya en la web** | ni se busca |
| **Seguro** | un único candidato y el título coincide → `--anilist-id` listo |
| **Dudoso** | varios candidatos, o uno que no coincide → se elige a mano |
| **Sin resultado** | AniList no lo conoce |

**Nunca crea un borrador de un emparejamiento dudoso.** Emparejar por título es
frágil (aquí «Call of the Night» ya se casó con Shimoneta una vez), y un
borrador equivocado cuesta más que preguntar. `--generar` solo toca los seguros.

Ni opiniones, ni notas, ni `physicalStores`: Whakoom dice qué tomos tienes, no
dónde los compraste ni qué te parecieron.

## Una ficha es una franquicia

Es la decisión de diseño central. *Las Quintillizas* son **una** ficha aunque en
Jellyfin estén la serie y la película por separado.

La franquicia se deduce del grafo de relaciones de AniList: desde cualquier entrada
se recorren `SEQUEL`, `PREQUEL` y `PARENT`, más `SIDE_STORY`/`ALTERNATIVE` **solo
cuando son película, OVA, especial u ONA** (si no, arrastran spin-offs que son obras
aparte). Los temas se recopilan de toda la franquicia y se anotan `(Temporada N)`.

## Qué tal acierta

Calibrado contra tus 8 fichas escritas a mano:

| Campo | Resultado |
|---|---|
| `hasManga` / `hasLightNovel` | **8 de 8 correctos** |
| `episodes` | correcto salvo el caso de Rent-a-Girlfriend (ver abajo) |
| `genres` | acierta los tuyos, y suele proponer 1-3 de más |
| `openings` / `endings` | correcto o ligeramente de más (incluye temas de OVAs) |
| `japaneseTitle` | difiere en la romanización; marcado para revisar |

Los tres campos marcados en `_meta._revisar` son exactamente donde conviene mirar:
`episodes`, `fullSynopsis` y `genres`.

## Limitaciones conocidas, sin disimular

- **Rent-a-Girlfriend sale como "3 temporadas + 2 OVA"** y tú pusiste "5 temporadas".
  No es un fallo del recorrido: AniList clasifica las temporadas 4 y 5 como ONA. Se
  deja como está en vez de inventar una corrección, y por eso `episodes` va marcado
  para revisar.
- **La romanización no coincidirá nunca.** Tú escribes "Haisukūru Dī Dī" y AniList
  "High School DxD"; tú "Roshia-go" y AniList "Rossiya-go". Es una preferencia tuya,
  no un error de nadie.
- **Los géneros vienen de más.** AniList no distingue "el género que define la obra"
  de "una etiqueta que aplica". Es más fácil borrar dos que investigar cinco.
- **Los títulos raros no se encuentran por búsqueda.** Tu ficha 3 se llama
  *"Rascal Does Not Dream of... (muchas variantes)"* y AniList no devuelve nada:
  para esas hace falta pasarle el `--anilist-id` a mano.
- **animethemes va por detrás en lo recién estrenado.** Para Mikadono devolvió 1
  ending y tú tienes 3.

## Lo que falta

- **Fase 3:** Jellyfin como disparador — que mire qué franquicias tienes en la
  biblioteca y no en la web, en vez de decirle tú el título. Necesita una API key
  de Jellyfin. Y un timer nocturno, no cada 15 minutos: para ~1 anime al mes,
  sondear cada cuarto de hora son 2.900 ejecuciones para un acierto.

Ver `../docs/integracion-jellyfin.md` para el plan completo.

---

## Qué papel tiene la IA, y por qué es el que es

El generador **accede a internet** y comprueba los datos. Lo que no hace es dejar
que el modelo de lenguaje afirme hechos.

**Datos y enlaces → fuentes deterministas.** AniList da el grafo de la franquicia,
los géneros y los booleanos. animethemes.moe da los temas **con el episodio exacto
en el que suena cada uno** y un enlace de vídeo real. Ninguno de los dos se
inventa nada: o lo tienen o no lo tienen.

**El LLM solo transforma texto que ya se le ha dado:** traducir la sinopsis y
proponer la descripción corta. Ni géneros, ni booleanos, ni números, ni enlaces,
ni valoraciones.

La razón no es teórica. Los 12 endings de Alya estuvieron mal durante meses porque
apuntaban a enlaces que nadie podía verificar, y arreglarlos costó 49 agentes
buscando en internet. Cuando después se le preguntó a animethemes, lo tenía bien
**a la primera**, incluyendo las dos correcciones de nombre que tanto costaron
(`ED6 = Himitsu no Kotoba`, `ED12 = Hanamoyoi`).

Un modelo de 9B diciendo "este es el vídeo del episodio 6" es exactamente el fallo
del que venimos. Una fuente que lo sabe, no.

### Verificación de enlaces

Antes de publicar, cada URL se comprueba pidiendo un kilobyte (`Range`, no `HEAD`:
`v.animethemes.moe` responde 403 a HEAD y 206 a un GET con rango).

- **404 y similares** → enlace roto: se sustituye por una búsqueda en YouTube.
- **403/429/5xx/timeout** → no concluyente: el enlace **se conserva** y se anota.
  Destruir un enlace bueno por un tropiezo de red sería peor que dejarlo.

Nunca se escribe una URL vacía, y nunca se inventa un identificador de vídeo.

## Flujo completo

```
python3 generar.py --titulo "..." --a-borradores        (en Pavilion)
        ↓  drafts/anime/<id>.json en la rama `borradores`
git fetch casa && git show casa/borradores:drafts/PENDIENTES.md   (en tu PC)
        ↓
node scripts/promote.mjs <id> --categoria "Viendo"
        ↓  la ficha entra en public/data/anime.json con tus campos vacíos
escribes tu opinión  →  git push casa main  →  publicado
```

La rama `borradores` **no puede romper la web**: el hook de despliegue solo actúa
sobre `main`, y `main` nunca contiene `drafts/`, así que el bot y tú no escribís
jamás en los mismos ficheros.

`promote.mjs` **se niega** a insertar la ficha si no le das `--categoria`, y se
niega si algún `anilistId` de esa franquicia ya está publicado.
