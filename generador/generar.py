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
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ANILIST_URL = "https://graphql.anilist.co"
ANIMETHEMES_URL = "https://api.animethemes.moe"

# Ollama vive en Strix, que se apaga a menudo. Es un REALCE, nunca un requisito:
# si no responde, el borrador sale igual con la sinopsis en ingles marcada para
# revisar. Configurable por si algun dia cambia de sitio.
OLLAMA_URL = os.environ.get("CO_OLLAMA", "http://192.168.50.14:11434") + "/api/generate"
OLLAMA_MODELO = os.environ.get("CO_MODELO", "qwen3.5:9b")
OLLAMA_TIMEOUT = 180
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

        # animethemes dice EN QUE EPISODIOS suena cada tema. Es el dato que evita
        # exactamente el desastre de los endings de Alya: 12 EDs distintos, uno
        # por episodio, que estaban todos apuntando al mismo video.
        entrada = (tema.get("animethemeentries") or [{}])[0]
        episodios = (entrada.get("episodes") or "").strip()
        video = (entrada.get("videos") or [{}])[0].get("link") or ""

        destino = ops if tipo == "OP" else eds if tipo == "ED" else None
        if destino is not None:
            destino.append({"nombre": etiqueta, "episodios": episodios, "video": video})
    return ops, eds


def anotar_episodio(episodios):
    """"6" -> " (Ep 6)". Un rango como "1-12" no aporta nada y se omite."""
    if episodios and episodios.isdigit():
        return f" (Ep {episodios})"
    return ""


def url_de_busqueda(texto):
    """Recambio cuando animethemes no tiene el video. Nunca se deja la url
    vacia: un boton clicable que no lleva a ningun sitio es peor."""
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
                anotacion = etiqueta_temp + anotar_episodio(t.get("episodios"))
                destino.append({
                    "name": t["nombre"] + anotacion,
                    # El video de animethemes es un enlace REAL y comprobable.
                    # Si no lo hay, se cae a una busqueda: jamas a un id inventado.
                    "url": t.get("video") or url_de_busqueda(f"{titulo} {t['nombre']}"),
                })
    return ops, eds


# --------------------------------------------------------------------------
# Verificacion de enlaces
#
# El generador no publica un enlace sin comprobar que responde. Esto es lo que
# habria evitado que los 12 endings de Alya apuntaran al video equivocado.
# Nota: se comprueba que el enlace EXISTE, no que sea el correcto; para eso
# esta usar animethemes, que dice de que episodio es cada tema.
# --------------------------------------------------------------------------

def url_viva(url):
    """Devuelve True (vive), False (rota) o None (no se pudo comprobar).

    Se pide un RANGO de un kilobyte, no un HEAD: v.animethemes.moe responde 403
    a HEAD y 206 a un GET con rango. Y un 5xx o un timeout NO se toman por
    enlace roto: son fallos transitorios (animethemes limita peticiones), y
    destruir un enlace bueno por un tropiezo de red seria peor que dejarlo.
    """
    if not url:
        return False
    if "youtube.com/results" in url:
        return True  # una busqueda siempre responde; comprobarla no aporta
    time.sleep(0.3)
    try:
        peticion = urllib.request.Request(
            url, headers={"User-Agent": "carlos-opinion-generador/1.0", "Range": "bytes=0-1024"})
        with urllib.request.urlopen(peticion, timeout=15) as r:
            return 200 <= r.status < 400
    except urllib.error.HTTPError as e:
        if 400 <= e.code < 500 and e.code not in (403, 405, 429):
            return False          # 404 y compania: roto de verdad
        return None               # 403/405/429/5xx: no concluyente
    except Exception:
        return None


def verificar_enlaces(ficha):
    rotos, dudosos = [], 0

    estado = url_viva(ficha.get("image"))
    if estado is False:
        rotos.append(f"portada: {ficha['image']}")
        ficha["image"] = ""
    elif estado is None and ficha.get("image"):
        dudosos += 1

    for clave in ("openings", "endings"):
        for t in ficha.get(clave) or []:
            estado = url_viva(t.get("url"))
            if estado is False:
                rotos.append(f"{clave}: {t.get('name')}")
                t["url"] = url_de_busqueda(t.get("name") or "")
            elif estado is None:
                dudosos += 1

    if rotos:
        ficha["_meta"].setdefault("_avisos", []).append(
            f"{len(rotos)} enlace(s) rotos, sustituidos por una busqueda: " + "; ".join(rotos[:5]))
    if dudosos:
        ficha["_meta"].setdefault("_avisos", []).append(
            f"{dudosos} enlace(s) no se pudieron comprobar (se dejan tal cual)")
    return ficha, len(rotos), dudosos


# --------------------------------------------------------------------------
# Ollama — SOLO transforma texto que ya se le da. Nunca "sabe cosas".
#
# Toca exactamente dos campos: traducir la sinopsis y proponer la descripcion
# corta. Ni generos, ni booleanos, ni numeros, ni notas, ni opiniones.
#
# Dos llamadas separadas y no una: en la prueba, pidiendole las dos cosas a la
# vez, el modelo intercambio los campos (metio el resumen en la sinopsis y la
# traduccion larga en la descripcion). Una tarea por llamada no se confunde, y
# ademas cada una puede fallar por su cuenta sin arrastrar a la otra.
# --------------------------------------------------------------------------

def _ollama(prompt, sistema, esquema, temperatura=0.2):
    cuerpo = {
        "model": OLLAMA_MODELO,
        "prompt": prompt,
        "system": sistema,
        "stream": False,
        "think": False,
        "format": esquema,
        "options": {"num_ctx": 4096, "temperature": temperatura},
    }
    peticion = urllib.request.Request(
        OLLAMA_URL, data=json.dumps(cuerpo).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(peticion, timeout=OLLAMA_TIMEOUT) as r:
        respuesta = json.loads(r.read().decode("utf-8"))
    return json.loads(respuesta["response"])


SISTEMA = ("Eres un traductor y redactor en espanol de Espana. Devuelves solo JSON. "
           "No inventas NADA que no este en el texto que se te da: ni titulos, ni "
           "nombres, ni datos, ni valoraciones. No opinas sobre la obra.")


def traducir_sinopsis(texto_en):
    esquema = {"type": "object", "properties": {"traduccion": {"type": "string"}},
               "required": ["traduccion"]}
    r = _ollama(
        "Traduce al espanol de Espana este texto, entero y sin resumirlo. "
        "Manten los nombres propios tal cual.\n\nTEXTO:\n" + texto_en,
        SISTEMA, esquema)
    return (r.get("traduccion") or "").strip()


def redactar_descripcion(texto):
    esquema = {"type": "object", "properties": {"descripcion": {"type": "string"}},
               "required": ["descripcion"]}
    r = _ollama(
        "Resume este texto en UNA sola frase de como mucho 30 palabras, en espanol "
        "de Espana. Es el texto que se lee bajo la portada, asi que tiene que "
        "enganchar sin destripar el final.\n\nTEXTO:\n" + texto,
        SISTEMA, esquema, temperatura=0.4)
    return (r.get("descripcion") or "").strip()


def dos_primeras_frases(texto):
    """Recambio determinista si Ollama no esta: cortar por el punto."""
    frases, actual = [], ""
    for ch in texto:
        actual += ch
        if ch == "." and len(actual.strip()) > 20:
            frases.append(actual.strip())
            actual = ""
            if len(frases) == 2:
                break
    return " ".join(frases).strip() or texto[:180]


def realzar_con_ollama(ficha):
    """Rellena fullSynopsis (en espanol) y description. Si Ollama no responde,
    el borrador sale igual: en ingles y marcado para revisar."""
    original = ficha.get("fullSynopsis") or ""
    if not original:
        return ficha, "sin sinopsis de origen"

    try:
        es = traducir_sinopsis(original)
        if es:
            ficha["fullSynopsis"] = es
        else:
            raise ValueError("traduccion vacia")
    except Exception as e:
        ficha["_meta"].setdefault("_avisos", []).append(
            f"sinopsis sin traducir (queda en ingles): {type(e).__name__}: {e}")
        ficha["description"] = dos_primeras_frases(original)
        return ficha, "degradado"

    try:
        ficha["description"] = redactar_descripcion(ficha["fullSynopsis"])
    except Exception as e:
        ficha["_meta"].setdefault("_avisos", []).append(
            f"descripcion sin redactar: {type(e).__name__}: {e}")
        ficha["description"] = dos_primeras_frases(ficha["fullSynopsis"])
        return ficha, "parcial"

    # La description es la primera frase que lee cualquiera de cada tarjeta y es
    # tu voz editorial, no un resumen neutro. La maquina te la deja escrita para
    # que no partas de una pagina en blanco, pero conviene reescribirla.
    ficha["_meta"]["_revisar"] = sorted(set(ficha["_meta"]["_revisar"]) | {"description"})
    return ficha, "ok"


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
# Publicacion en la rama `borradores`
#
# La regla que hace que esto no pueda romper nada: `main` NUNCA contiene
# drafts/, y la rama `borradores` se reconstruye desde main en cada pasada. Como
# el bot y Carlos no escriben jamas en los mismos ficheros, el conflicto no es
# que este "gestionado": es estructuralmente imposible.
#
# Y el hook de despliegue solo actua sobre refs/heads/main, asi que empujar esta
# rama no publica nada en la web. Pase lo que pase aqui, la web sigue sirviendo
# lo ultimo que publicaste tu.
# --------------------------------------------------------------------------

BASE = os.environ.get("CO_BASE", "/home/carlosalexei/carlos-opinion")
REPO_BARE = os.path.join(BASE, "repo.git")
WORK = os.path.join(BASE, "generador", "work")
RAMA_BORRADORES = "borradores"


def _git(*args, cwd=WORK, permitir_fallo=False):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0 and not permitir_fallo:
        raise ErrorFuente(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip()


def publicar_borrador(ficha):
    if not os.path.isdir(os.path.join(WORK, ".git")):
        os.makedirs(os.path.dirname(WORK), exist_ok=True)
        subprocess.run(["git", "clone", "--quiet", REPO_BARE, WORK], check=True)

    _git("fetch", "--quiet", "origin")

    # Se parte SIEMPRE de main limpio: la rama es derivada, no acumulativa.
    _git("checkout", "-B", RAMA_BORRADORES, "origin/main")
    _git("reset", "--quiet", "--hard", f"origin/main")
    _git("clean", "-qfd")

    # ...pero se conservan los borradores que ya hubiera pendientes.
    existe = _git("ls-remote", "--heads", "origin", RAMA_BORRADORES, permitir_fallo=True)
    if existe:
        _git("checkout", f"origin/{RAMA_BORRADORES}", "--", "drafts", permitir_fallo=True)

    ids = ficha["_meta"]["anilistIds"]
    destino = os.path.join(WORK, "drafts", "anime", f"{ids[0]}.json")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(ficha, f, ensure_ascii=False, indent=2)
        f.write("\n")

    _escribir_indice()

    _git("add", "-A", "drafts")
    if not _git("status", "--porcelain", "drafts"):
        return None, "sin cambios"
    _git("-c", "user.name=generador", "-c", "user.email=generador@carlos-opinion",
         "commit", "--quiet", "-m", f"Borrador: {ficha['title']}")
    _git("push", "--quiet", "--force", "origin", f"HEAD:{RAMA_BORRADORES}")
    return os.path.relpath(destino, WORK), "publicado"


def _escribir_indice():
    """PENDIENTES.md dentro de la propia rama: el aviso viaja con los datos.
    Un fichero suelto en el home de Pavilion es un buzon que nadie visita."""
    carpeta = os.path.join(WORK, "drafts", "anime")
    filas = []
    for nombre in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        if not nombre.endswith(".json"):
            continue
        with open(os.path.join(carpeta, nombre), encoding="utf-8") as f:
            b = json.load(f)
        avisos = b.get("_meta", {}).get("_avisos") or []
        filas.append(f"| `{nombre[:-5]}` | {b.get('title', '?')} | {b.get('episodes', '')} | "
                     f"{'⚠️ ' + str(len(avisos)) if avisos else '—'} |")

    texto = [
        "# Borradores pendientes",
        "",
        "Generados automaticamente. **Ninguno esta publicado**: la web sigue sirviendo",
        "lo ultimo que subiste tu a `main`.",
        "",
        "Para promocionar uno, desde tu PC:",
        "",
        "```bash",
        "git fetch casa",
        "node scripts/promote.mjs <id> --categoria \"Viendo\"",
        "```",
        "",
        "| id AniList | Titulo | Alcance | Avisos |",
        "|---|---|---|---|",
        *filas,
        "",
        f"Total: {len(filas)} borrador{'es' if len(filas) != 1 else ''}.",
        "",
    ]
    with open(os.path.join(WORK, "drafts", "PENDIENTES.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(texto))


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
    p.add_argument("--sin-ollama", action="store_true", help="no traducir ni redactar")
    p.add_argument("--sin-verificar", action="store_true", help="no comprobar que los enlaces responden")
    p.add_argument("--a-borradores", action="store_true",
                   help="publicar el borrador en la rama `borradores` en vez de imprimirlo")
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

    if not args.sin_ollama:
        ficha, estado = realzar_con_ollama(ficha)
        print(f"# Ollama: {estado}", file=sys.stderr)

    if not args.sin_verificar:
        ficha, rotos, dudosos = verificar_enlaces(ficha)
        print(f"# Enlaces: {rotos} rotos, {dudosos} sin comprobar", file=sys.stderr)

    if args.a_borradores:
        ruta, estado = publicar_borrador(ficha)
        print(f"# {estado}" + (f": {ruta}" if ruta else ""), file=sys.stderr)
        print(f"# Revisalo con: git fetch casa && git show "
              f"casa/borradores:drafts/anime/{ficha['_meta']['anilistIds'][0]}.json", file=sys.stderr)
    else:
        print(json.dumps(ficha, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
