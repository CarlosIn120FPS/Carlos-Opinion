#!/usr/bin/env python3
"""Generador de borradores de ficha para Carlos' Opinion.

FASE 1: solo fuentes publicas sin clave (AniList + animethemes.moe).
Jellyfin y TMDB entran despues como fuentes opcionales.

La unidad de una ficha es la FRANQUICIA entera, no la temporada ni la pelicula:
"Las Quintillizas" es una ficha aunque en Jellyfin esten la serie y la pelicula
por separado. La franquicia se deduce del grafo de relaciones de AniList.

Lo que este script NO hace nunca: escribir category, rating, ratingFinal,
personalOpinion, personalOpinionFinal, doIRecommend ni willReadSource. Esos son
de Carlos y salen vacios.

Uso:
    ./generar.py --titulo "Alya Sometimes Hides Her Feelings in Russian"
    ./generar.py --anilist-id 162804
    ./generar.py --calibrar ../public/data/anime.json
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ANILIST_URL = "https://graphql.anilist.co"
ANIMETHEMES_URL = "https://api.animethemes.moe"
TIMEOUT = 20  # sin esto, un servidor que no responde cuelga el proceso para siempre
PAUSA = 0.8   # AniList limita a 90 peticiones/min; vamos holgados

# --------------------------------------------------------------------------
# Generos: tabla estatica, nunca un LLM. Un genero inventado ensucia el
# vocabulario de la web para siempre, y la tabla es mas corta que el prompt.
# --------------------------------------------------------------------------

# Los 19 generos de AniList son un conjunto cerrado.
GENEROS_ANILIST = {
    "Action": "Acción",
    "Adventure": "Aventura",
    "Comedy": "Comedia",
    "Drama": "Drama",
    "Ecchi": "Ecchi",
    "Fantasy": "Fantasía",
    "Horror": "Terror",
    "Mahou Shoujo": "Mahou Shoujo",
    "Mecha": "Mecha",
    "Music": "Música",
    "Mystery": "Misterio",
    "Psychological": "Psicológico",
    "Romance": "Romance",
    "Sci-Fi": "Ciencia ficción",
    "Slice of Life": "Slice of life",
    "Sports": "Deportes",
    "Supernatural": "Sobrenatural",
    "Thriller": "Thriller",
}

# Los tags si son abiertos, asi que solo se aceptan estos y con rank alto.
# OJO con los nombres: en AniList el tag NO se llama "Harem" sino "Female Harem"
# (rank 90 en High School DxD, 86 en Rent-a-Girlfriend). Con el nombre corto se
# perdia en las dos fichas donde Carlos si lo habia puesto a mano.
TAGS_ACEPTADOS = {
    "School": "Escolar",
    "Female Harem": "Harem",
    "Male Harem": "Harem inverso",
    "Isekai": "Isekai",
    "Gore": "Gore",
}
# 70 y no 60: con 60 se colaba "Iyashikei" (68) en My Dress Up Darling, que
# Carlos no habia puesto. Trimar de menos cansa menos que trimar de mas.
RANK_MINIMO_TAG = 70

# Relaciones que forman parte de la MISMA franquicia.
RELACIONES_FRANQUICIA = {"SEQUEL", "PREQUEL", "PARENT", "SIDE_STORY", "ALTERNATIVE"}
# ...pero SIDE_STORY y ALTERNATIVE solo si son pelicula/OVA/especial: si no,
# arrastran spin-offs que son obras aparte.
FORMATOS_SECUNDARIOS = {"MOVIE", "OVA", "SPECIAL", "ONA"}

CONSULTA_MEDIA = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    format
    status
    episodes
    seasonYear
    startDate { year }
    genres
    tags { name rank }
    description(asHtml: false)
    coverImage { extraLarge large }
    source
    relations {
      edges {
        relationType(version: 2)
        node { id type format status title { romaji } }
      }
    }
  }
}
"""

CONSULTA_BUSQUEDA = """
query ($busqueda: String) {
  Page(page: 1, perPage: 5) {
    media(search: $busqueda, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      format
      seasonYear
    }
  }
}
"""


class ErrorFuente(Exception):
    """Una fuente externa fallo. Nunca se inventa el dato: se propaga."""


REINTENTOS = 3


def _pedir_json(url, datos=None, cabeceras=None):
    """Con reintentos: AniList da timeouts esporadicos, y sin esto una ficha
    entera se caia por un fallo de red de un segundo."""
    cab = {"User-Agent": "carlos-opinion-generador/1.0", "Accept": "application/json"}
    if cabeceras:
        cab.update(cabeceras)
    cuerpo = None
    if datos is not None:
        cuerpo = json.dumps(datos).encode("utf-8")
        cab["Content-Type"] = "application/json"

    ultimo = None
    for intento in range(REINTENTOS):
        peticion = urllib.request.Request(url, data=cuerpo, headers=cab)
        try:
            with urllib.request.urlopen(peticion, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            # 4xx que no sea 429 es culpa nuestra: reintentar no arregla nada.
            if e.code != 429 and 400 <= e.code < 500:
                raise ErrorFuente(f"HTTP {e.code} en {url}") from e
            ultimo = ErrorFuente(f"HTTP {e.code} en {url}")
        except Exception as e:
            ultimo = ErrorFuente(f"{type(e).__name__} en {url}: {e}")
        if intento < REINTENTOS - 1:
            time.sleep(2 ** intento)  # 1s, 2s
    raise ultimo


def anilist(consulta, variables):
    time.sleep(PAUSA)
    r = _pedir_json(ANILIST_URL, {"query": consulta, "variables": variables})
    if "errors" in r:
        raise ErrorFuente(f"AniList: {r['errors']}")
    return r["data"]


def buscar_en_anilist(titulo):
    datos = anilist(CONSULTA_BUSQUEDA, {"busqueda": titulo})
    return datos["Page"]["media"]


def media_por_id(anilist_id):
    return anilist(CONSULTA_MEDIA, {"id": anilist_id})["Media"]


# --------------------------------------------------------------------------
# Franquicia: recorrido en anchura del grafo de relaciones
# --------------------------------------------------------------------------

def franquicia(anilist_id, limite=25):
    """Devuelve todos los Media de la franquicia, ordenados cronologicamente."""
    vistos, pendientes, obras = set(), [anilist_id], []
    while pendientes and len(vistos) < limite:
        actual = pendientes.pop(0)
        if actual in vistos:
            continue
        vistos.add(actual)
        try:
            m = media_por_id(actual)
        except ErrorFuente as e:
            print(f"    aviso: no se pudo leer el nodo {actual}: {e}", file=sys.stderr)
            continue
        obras.append(m)
        for arista in m.get("relations", {}).get("edges", []):
            nodo = arista.get("node") or {}
            tipo = arista.get("relationType")
            if nodo.get("type") != "ANIME" or nodo.get("id") in vistos:
                continue
            if tipo in ("SEQUEL", "PREQUEL", "PARENT"):
                pendientes.append(nodo["id"])
            elif tipo in ("SIDE_STORY", "ALTERNATIVE") and nodo.get("format") in FORMATOS_SECUNDARIOS:
                pendientes.append(nodo["id"])

    def clave(m):
        return (m.get("seasonYear") or (m.get("startDate") or {}).get("year") or 9999, m["id"])

    return sorted(obras, key=clave)


def raiz_de_la_franquicia(obras):
    """La obra principal: la serie de TV mas antigua; si no hay, la mas antigua."""
    series = [m for m in obras if m.get("format") == "TV"]
    return (series or obras)[0]


# --------------------------------------------------------------------------
# Campos derivados
# --------------------------------------------------------------------------

def mapear_generos(obras):
    salida = []
    for m in obras:
        for g in m.get("genres") or []:
            es = GENEROS_ANILIST.get(g)
            if es and es not in salida:
                salida.append(es)
        for t in m.get("tags") or []:
            if (t.get("rank") or 0) < RANK_MINIMO_TAG:
                continue
            es = TAGS_ACEPTADOS.get(t.get("name"))
            if es and es not in salida:
                salida.append(es)
    return salida


SIN_EMITIR = {"NOT_YET_RELEASED", "CANCELLED"}


def emitida(m):
    return (m.get("status") or "") not in SIN_EMITIR


def describir_alcance(obras):
    """El campo `episodes`: describe la franquicia entera, como ya hace Carlos.

    Lo anunciado y aun no emitido se anota aparte, no se suma: si no, una
    temporada de 2027 convertia "1 temporada/12 episodios" en el sinsentido
    "2 temporadas/12 episodios". Carlos ya usa este patron en la ficha 3
    ("+ 1 pelicula anunciada para 2026").
    """
    emitidas = [m for m in obras if emitida(m)]
    futuras = [m for m in obras if not emitida(m)]

    tv = [m for m in emitidas if m.get("format") == "TV"]
    pelis = [m for m in emitidas if m.get("format") == "MOVIE"]
    otros = [m for m in emitidas if m.get("format") in ("OVA", "SPECIAL", "ONA")]
    caps = sum(m.get("episodes") or 0 for m in tv)

    partes = []
    if tv:
        partes.append(
            f"{len(tv)} temporada{'s' if len(tv) != 1 else ''}/{caps} episodios"
            if caps else f"{len(tv)} temporada{'s' if len(tv) != 1 else ''}"
        )
    if pelis:
        partes.append(f"{len(pelis)} película{'s' if len(pelis) != 1 else ''}")
    if otros:
        partes.append(f"{len(otros)} OVA/especiales")

    for m in futuras:
        que = "temporada" if m.get("format") == "TV" else "película" if m.get("format") == "MOVIE" else "entrega"
        ano = m.get("seasonYear") or (m.get("startDate") or {}).get("year")
        partes.append(f"1 {que} anunciada{f' para {ano}' if ano else ''}")

    return " + ".join(partes)


# En AniList `source` dice en que se BASA el anime, no que adaptaciones existen.
# Alya se basa en una novela ligera Y ademas tiene manga: mirando solo `source`
# el manga se perdia. Las adaptaciones estan en las relaciones, como nodos MANGA.
FORMATOS_MANGA = {"MANGA", "ONE_SHOT"}
FORMATOS_NOVELA = {"NOVEL"}


def tiene_fuente(obras):
    """hasManga / hasLightNovel: mira `source` Y las relaciones no-anime."""
    manga = novela = False
    for m in obras:
        s = (m.get("source") or "").upper()
        if s == "MANGA":
            manga = True
        elif s in ("LIGHT_NOVEL", "NOVEL"):
            novela = True
        for arista in m.get("relations", {}).get("edges", []):
            nodo = arista.get("node") or {}
            if nodo.get("type") != "MANGA":
                continue
            if nodo.get("format") in FORMATOS_MANGA:
                manga = True
            elif nodo.get("format") in FORMATOS_NOVELA:
                novela = True
    return manga, novela


def titulo_japones(raiz):
    romaji = (raiz.get("title") or {}).get("romaji") or ""
    nativo = (raiz.get("title") or {}).get("native") or ""
    if romaji and nativo:
        return f"{romaji} ({nativo})"
    return romaji or nativo


def limpiar_descripcion(texto):
    if not texto:
        return ""
    for a, b in (("<br>", " "), ("<br/>", " "), ("<br />", " "), ("<i>", ""), ("</i>", ""),
                 ("<b>", ""), ("</b>", ""), ("&mdash;", "—"), ("&amp;", "&"), ("&quot;", '"')):
        texto = texto.replace(a, b)
    return " ".join(texto.split())


# --------------------------------------------------------------------------
# animethemes.moe — openings y endings, por temporada
# --------------------------------------------------------------------------

def temas_de(anilist_id):
    url = (
        f"{ANIMETHEMES_URL}/anime?filter[has]=resources"
        f"&filter[site]=AniList&filter[external_id]={anilist_id}"
        f"&include=animethemes.song.artists,animethemes.animethemeentries.videos"
    )
    time.sleep(PAUSA)
    datos = _pedir_json(url)
    anime = (datos.get("anime") or [])
    if not anime:
        return [], []
    ops, eds = [], []
    for tema in anime[0].get("animethemes") or []:
        tipo = tema.get("type")
        cancion = (tema.get("song") or {})
        nombre = cancion.get("title") or tema.get("slug") or "?"
        artistas = ", ".join(a.get("name", "") for a in (cancion.get("artists") or []) if a.get("name"))
        etiqueta = f"{nombre} - {artistas}" if artistas else nombre
        destino = ops if tipo == "OP" else eds if tipo == "ED" else None
        if destino is not None:
            destino.append({"nombre": etiqueta, "slug": tema.get("slug")})
    return ops, eds


def url_de_busqueda(texto):
    """Nunca se deja la url vacia: un boton clicable que no lleva a ningun sitio
    es peor que un enlace de busqueda. Es el patron que Carlos ya usa."""
    return "https://www.youtube.com/results?search_query=" + urllib.parse.quote(texto)


def recopilar_temas(obras):
    """Recorre TODA la franquicia y anota por temporada, como hace Carlos."""
    ops, eds = [], []
    # Lo no emitido no tiene temas y no debe desplazar la numeracion de temporadas.
    emitidas = [m for m in obras if emitida(m)]
    tv = [m for m in emitidas if m.get("format") == "TV"]
    for m in emitidas:
        etiqueta_temp = ""
        if len(tv) > 1 and m in tv:
            etiqueta_temp = f" (Temporada {tv.index(m) + 1})"
        elif m.get("format") == "MOVIE":
            etiqueta_temp = " (Película)"
        try:
            o, e = temas_de(m["id"])
        except ErrorFuente as ex:
            print(f"    aviso: animethemes fallo para {m['id']}: {ex}", file=sys.stderr)
            continue
        titulo = (m.get("title") or {}).get("romaji") or ""
        for lista, destino in ((o, ops), (e, eds)):
            for t in lista:
                destino.append({
                    "name": t["nombre"] + etiqueta_temp,
                    "url": url_de_busqueda(f"{titulo} {t['nombre']}"),
                })
    return ops, eds


# --------------------------------------------------------------------------
# Construccion del borrador
# --------------------------------------------------------------------------

CAMPOS_DE_CARLOS = [
    "category", "rating", "ratingFinal",
    "personalOpinion", "personalOpinionFinal",
    "doIRecommend", "willReadSource",
]


def construir_borrador(anilist_id, con_temas=True):
    obras = franquicia(anilist_id)
    if not obras:
        raise ErrorFuente(f"no se pudo construir la franquicia de {anilist_id}")
    raiz = raiz_de_la_franquicia(obras)
    manga, novela = tiene_fuente(obras)
    ops, eds = ([], [])
    if con_temas:
        ops, eds = recopilar_temas(obras)

    ficha = {
        "title": (raiz.get("title") or {}).get("english") or (raiz.get("title") or {}).get("romaji"),
        "japaneseTitle": titulo_japones(raiz),
        "image": ((raiz.get("coverImage") or {}).get("extraLarge")
                  or (raiz.get("coverImage") or {}).get("large") or ""),
        "description": "",   # la escribe Carlos; el LLM la propondra en la fase 2
        "genres": mapear_generos(obras),
        "fullSynopsis": limpiar_descripcion(raiz.get("description")),
        "episodes": describir_alcance(obras),
        "hasManga": manga,
        "hasLightNovel": novela,
        "platforms": [],     # deliberadamente vacio: es prosa con opinion
        "languages": [],     # deliberadamente vacio: los MediaStreams mienten
        "openings": ops,
        "endings": eds,
    }
    for c in CAMPOS_DE_CARLOS:
        ficha[c] = ""

    ficha["_meta"] = {
        "anilistIds": [m["id"] for m in obras],
        "franquicia": [
            {"id": m["id"], "formato": m.get("format"),
             "ano": m.get("seasonYear") or (m.get("startDate") or {}).get("year"),
             "titulo": (m.get("title") or {}).get("romaji")}
            for m in obras
        ],
        "_revisar": ["episodes", "fullSynopsis", "genres"],
    }
    return ficha


# --------------------------------------------------------------------------
# Calibracion contra las fichas que Carlos ya escribio a mano
# --------------------------------------------------------------------------

def calibrar(ruta_json, solo=None):
    with open(ruta_json, encoding="utf-8") as f:
        datos = json.load(f)
    items = datos["items"]
    if solo:
        items = [i for i in items if str(i.get("id")) == str(solo)]

    for it in sorted(items, key=lambda x: x.get("id", 0)):
        print("=" * 78)
        print(f"FICHA {it.get('id')}: {it.get('title')}")
        busqueda = it.get("title", "")
        try:
            candidatos = buscar_en_anilist(busqueda)
        except ErrorFuente as e:
            print(f"  ERROR buscando en AniList: {e}")
            continue
        if not candidatos:
            print(f"  AniList no encuentra nada con «{busqueda}»  <-- necesita anilistId a mano")
            continue
        elegido = candidatos[0]
        print(f"  AniList: #{elegido['id']} {elegido['title'].get('romaji')} "
              f"({elegido.get('format')}, {elegido.get('seasonYear')})")
        if len(candidatos) > 1:
            otros = ", ".join(f"#{c['id']} {c['title'].get('romaji')}" for c in candidatos[1:3])
            print(f"           otros candidatos: {otros}")
        try:
            b = construir_borrador(elegido["id"], con_temas=True)
        except ErrorFuente as e:
            print(f"  ERROR construyendo: {e}")
            continue

        fr = b["_meta"]["franquicia"]
        print(f"  franquicia detectada ({len(fr)} obras): "
              + ", ".join(f"{o['formato']}/{o['ano']}" for o in fr))
        print()
        comparar("japaneseTitle", it.get("japaneseTitle"), b["japaneseTitle"])
        comparar("episodes", it.get("episodes"), b["episodes"])
        # Los generos se comparan como conjunto: el orden no significa nada.
        comparar("genres", sorted(it.get("genres") or []), sorted(b["genres"]),
                 mostrar_tuyo=", ".join(it.get("genres") or []),
                 mostrar_generado=", ".join(b["genres"]))
        comparar("hasManga", it.get("hasManga"), b["hasManga"])
        comparar("hasLightNovel", it.get("hasLightNovel"), b["hasLightNovel"])
        comparar("openings", f"{len(it.get('openings') or [])} temas", f"{len(b['openings'])} temas")
        comparar("endings", f"{len(it.get('endings') or [])} temas", f"{len(b['endings'])} temas")
        print()


def comparar(campo, tuyo, generado, mostrar_tuyo=None, mostrar_generado=None):
    igual = str(tuyo).strip().lower() == str(generado).strip().lower()
    marca = "  =" if igual else "  ~"
    print(f"{marca} {campo}")
    print(f"      tuyo:     {mostrar_tuyo if mostrar_tuyo is not None else tuyo}")
    if not igual:
        print(f"      generado: {mostrar_generado if mostrar_generado is not None else generado}")


def main():
    p = argparse.ArgumentParser(description="Generador de borradores de ficha")
    p.add_argument("--titulo", help="buscar por titulo en AniList")
    p.add_argument("--anilist-id", type=int, help="id de AniList concreto")
    p.add_argument("--calibrar", metavar="RUTA", help="comparar contra un anime.json existente")
    p.add_argument("--solo", help="con --calibrar, solo esta ficha (por id)")
    p.add_argument("--sin-temas", action="store_true", help="saltar animethemes (mas rapido)")
    args = p.parse_args()

    if args.calibrar:
        calibrar(args.calibrar, args.solo)
        return

    anilist_id = args.anilist_id
    if not anilist_id:
        if not args.titulo:
            p.error("hace falta --titulo, --anilist-id o --calibrar")
        candidatos = buscar_en_anilist(args.titulo)
        if not candidatos:
            print(f"AniList no encuentra nada con «{args.titulo}»", file=sys.stderr)
            sys.exit(1)
        anilist_id = candidatos[0]["id"]
        print(f"# AniList #{anilist_id}: {candidatos[0]['title'].get('romaji')}", file=sys.stderr)

    ficha = construir_borrador(anilist_id, con_temas=not args.sin_temas)
    print(json.dumps(ficha, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
