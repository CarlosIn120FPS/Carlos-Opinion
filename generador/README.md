# Generador de borradores de ficha — Fase 1

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
| Ollama | todavía no (fase 2) |
| Jellyfin | todavía no (fase 2) — de momento se le dice qué anime generar |
| Escribe en git | no, imprime por pantalla |

## Uso

```bash
python3 generar.py --titulo "Alya Sometimes Hides Her Feelings in Russian"
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
