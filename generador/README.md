# Generador de borradores de ficha

Genera el esqueleto de una ficha de anime a partir de fuentes públicas, para no
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

python3 generar.py --sin-ollama --sin-verificar   # más rápido, sin realce"
python3 generar.py --anilist-id 162804
python3 generar.py --anilist-id 162804 --sin-temas     # más rápido

# comparar contra lo que ya escribiste a mano
python3 generar.py --calibrar ../public/data/anime.json
python3 generar.py --calibrar ../public/data/anime.json --solo 8
```

Vive en Pavilion, en `~/carlos-opinion/generador/`.

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

## Lo que falta (fases siguientes)

- **Fase 2:** Ollama para traducir la sinopsis y proponer la descripción corta;
  escritura de borradores a la rama `borradores`; `promote.mjs` para insertarlos.
- **Fase 3:** Jellyfin como disparador (qué franquicias hay que no estén ya en la
  web) y timer nocturno.

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
