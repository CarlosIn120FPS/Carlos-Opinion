#!/usr/bin/env python3
"""Importador de Whakoom: de la exportacion de la coleccion (xlsx) a borradores.

Whakoom no tiene API y raspar su web esta prohibido por sus condiciones. Lo que
si hay es la exportacion manual de la coleccion (cuenta PRO), que sale como
xlsx. Este script corre EN EL PC de Carlos, no en Pavilion: su coleccion es un
dato personal y no tiene por que salir de casa. El fichero va en
generador/work/ (en .gitignore).

    python3 whakoom.py work/whakoom.xlsx                 # emparejar e informar
    python3 whakoom.py work/whakoom.xlsx --generar       # ademas, borradores de los SEGUROS
    python3 whakoom.py work/whakoom.xlsx --columnas serie=Serie,numero=Numero

Lo que hace:
  1. Lee el xlsx sin dependencias (es un zip con XML: zipfile + ElementTree).
  2. Detecta las columnas por el nombre de la cabecera (titulo, serie, numero,
     autor, editorial, tipo...). Si no acierta, se le dice con --columnas.
  3. Agrupa las filas (una por tomo) en SERIES y cuenta los tomos que tiene.
  4. Para cada serie: si ya esta en manga.json / lightnovels.json, lo dice; si
     no, la busca en AniList (con cache) y decide:
        SEGURO    un solo candidato cuyo titulo coincide con el de Whakoom
        DUDOSO    varios candidatos, o uno que no coincide -> lista para elegir
        SIN NADA  AniList no encuentra nada
  5. Escribe work/whakoom-emparejado.json con todo, e imprime el resumen.

NUNCA crea un borrador de un emparejamiento dudoso: emparejar por titulo es
fragil (en este proyecto "Call of the Night" ya se caso con Shimoneta una
vez), y un borrador equivocado cuesta mas que preguntar. Con --generar solo se
generan los SEGUROS; los dudosos salen con su `--anilist-id` para decidir a
mano y lanzar generar.py.

Ni opiniones ni notas: eso es de Carlos. Y physicalStores tampoco: Whakoom
dice que tomos tiene, no donde los compro.
"""

import argparse
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import generar  # noqa: E402  (mismo directorio: busqueda, cache, borradores)

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

# --------------------------------------------------------------- leer el xlsx


def _columna_a_indice(ref):
    """'A1' -> 0, 'AB12' -> 27. Las celdas vacias no aparecen en el XML: sin
    esto, una fila con la columna C vacia desplazaria D a la posicion de C."""
    letras = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for c in letras:
        n = n * 26 + (ord(c) - 64)
    return n - 1


def _texto_de(nodo):
    """Une todos los <t> de un <si> o un <is> (los textos con formato vienen
    troceados en varios <r><t>)."""
    return "".join(t.text or "" for t in nodo.iter(f"{{{NS['m']}}}t"))


def leer_xlsx(ruta, hoja=None):
    """Devuelve (cabeceras, filas) de la primera hoja (o de `hoja`), como listas
    de cadenas. La primera fila no vacia es la cabecera."""
    with zipfile.ZipFile(ruta) as z:
        nombres = z.namelist()
        compartidas = []
        if "xl/sharedStrings.xml" in nombres:
            raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
            compartidas = [_texto_de(si) for si in raiz.findall("m:si", NS)]

        hojas = sorted(n for n in nombres if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
        if not hojas:
            raise ValueError(f"{ruta} no tiene ninguna hoja: ¿es un xlsx?")
        if hoja is not None:
            candidata = f"xl/worksheets/sheet{hoja}.xml"
            if candidata not in hojas:
                raise ValueError(f"no hay hoja {hoja}; hay {len(hojas)}")
            hojas = [candidata]

        raiz = ET.fromstring(z.read(hojas[0]))
        filas = []
        for fila in raiz.iter(f"{{{NS['m']}}}row"):
            celdas = {}
            for c in fila.findall("m:c", NS):
                ref = c.get("r") or ""
                tipo = c.get("t")
                v = c.find("m:v", NS)
                if tipo == "s" and v is not None and v.text is not None:
                    valor = compartidas[int(v.text)]
                elif tipo == "inlineStr":
                    isn = c.find("m:is", NS)
                    valor = _texto_de(isn) if isn is not None else ""
                elif v is not None and v.text is not None:
                    valor = v.text
                    # Excel guarda los enteros como "3.0" a veces; que sea "3".
                    if re.fullmatch(r"-?\d+\.0", valor):
                        valor = valor[:-2]
                else:
                    valor = ""
                if ref:
                    celdas[_columna_a_indice(ref)] = valor.strip()
            if not celdas:
                continue
            ancho = max(celdas) + 1
            filas.append([celdas.get(i, "") for i in range(ancho)])

    filas = [f for f in filas if any(f)]
    if not filas:
        return [], []
    cabeceras = filas[0]
    ancho = len(cabeceras)
    cuerpo = [(f + [""] * ancho)[:ancho] for f in filas[1:]]
    return cabeceras, cuerpo


# ---------------------------------------------------------- las columnas


# Que columna hace de que. Se compara sin acentos ni mayusculas.
SINONIMOS = {
    "serie": ["serie", "series", "coleccion", "collection", "obra"],
    "titulo": ["titulo", "title", "nombre", "name", "comic", "libro"],
    "numero": ["numero", "num", "number", "no", "n", "tomo", "volumen", "volume", "vol", "issue"],
    "autor": ["autor", "autores", "author", "authors", "guion", "guionista", "writer"],
    "editorial": ["editorial", "publisher", "sello"],
    "tipo": ["tipo", "type", "formato", "format", "categoria"],
    "estado": ["estado", "status", "leido", "read"],
    "isbn": ["isbn", "ean", "codigo"],
    "fecha": ["fecha", "date", "anadido", "added"],
}


def _clave(texto):
    return generar._normalizar(texto).replace(" ", "")


def detectar_columnas(cabeceras, forzadas=None):
    """{rol: indice}. `forzadas` es {rol: nombre de cabecera} y manda."""
    claves = [_clave(c) for c in cabeceras]
    roles = {}
    for rol, nombres in SINONIMOS.items():
        for i, k in enumerate(claves):
            if k in nombres and i not in roles.values():
                roles[rol] = i
                break
    for rol, nombre in (forzadas or {}).items():
        k = _clave(nombre)
        if k not in claves:
            raise ValueError(f"no hay ninguna columna «{nombre}». Hay: {', '.join(cabeceras)}")
        roles[rol] = claves.index(k)
    if "titulo" not in roles and "serie" not in roles:
        raise ValueError(
            "no encuentro la columna del titulo. Cabeceras: "
            + ", ".join(cabeceras) + ". Dimelo con --columnas titulo=NOMBRE")
    return roles


# ------------------------------------------------------------ las series


PATRON_NUMERO = re.compile(
    r"\s*(?:[#№]|n[ºo°]\.?|nº|vol\.?|volumen|tomo|tome|v\.?)\s*(\d+)\s*$|\s+(\d{1,3})\s*$",
    re.IGNORECASE,
)


def partir_titulo(titulo):
    """'Chainsaw Man #3' -> ('Chainsaw Man', 3). Sin numero -> (titulo, None)."""
    t = (titulo or "").strip()
    m = PATRON_NUMERO.search(t)
    if not m:
        return t, None
    n = int(m.group(1) or m.group(2))
    return t[: m.start()].strip(" -–:,"), n


def _entero(texto):
    m = re.search(r"\d+", str(texto or ""))
    return int(m.group(0)) if m else None


def agrupar_series(cabeceras, filas, roles):
    """Una serie por obra, con la lista de tomos que hay. Si el xlsx tiene
    columna de serie se usa; si no, se saca del titulo quitando el numero."""
    series = {}
    for fila in filas:
        def col(rol):
            i = roles.get(rol)
            return fila[i] if i is not None and i < len(fila) else ""

        serie = col("serie")
        titulo = col("titulo")
        numero = _entero(col("numero"))
        if not serie:
            serie, n2 = partir_titulo(titulo)
            if numero is None:
                numero = n2
        if not serie:
            continue
        k = generar._normalizar(serie)
        s = series.setdefault(k, {
            "serie": serie, "tomos": [], "filas": 0,
            "autor": "", "editorial": "", "tipo": "", "isbn": [],
        })
        s["filas"] += 1
        if numero is not None and numero not in s["tomos"]:
            s["tomos"].append(numero)
        for rol in ("autor", "editorial", "tipo"):
            if not s[rol] and col(rol):
                s[rol] = col(rol)
        if col("isbn"):
            s["isbn"].append(col("isbn"))
    for s in series.values():
        s["tomos"].sort()
    return list(series.values())


# ------------------------------------------------------------ emparejar


def _titulos_publicados(carpeta_datos):
    """{titulo normalizado: (seccion, titulo)} de manga.json y lightnovels.json."""
    salida = {}
    for fichero, clave in (("manga.json", "manga"), ("lightnovels.json", "lightnovel")):
        ruta = os.path.join(carpeta_datos, fichero)
        if not os.path.isfile(ruta):
            continue
        with open(ruta, encoding="utf-8") as f:
            for it in json.load(f).get("items", []):
                for t in (it.get("title"), it.get("japaneseTitle")):
                    n = generar._normalizar(t)
                    if n:
                        salida[n] = (clave, it.get("title"), it.get("id"))
    return salida


def buscar_con_cache(titulo):
    clave = re.sub(r"[^a-z0-9]+", "-", generar._normalizar(titulo))[:80] or "vacio"
    en_cache = generar._cache_leer("busqueda-manga", clave)
    if en_cache is not None:
        return en_cache
    r = generar.buscar_en_anilist(titulo, "MANGA")
    generar._cache_escribir("busqueda-manga", clave, r)
    return r


def _seccion_de(formato):
    if formato in generar.FORMATOS_NOVELA:
        return "lightnovel"
    if formato in generar.FORMATOS_MANGA:
        return "manga"
    return None


def _quiere_novela(serie):
    return "novel" in generar._normalizar(serie.get("tipo", "")) or "novela" in (serie.get("tipo") or "").lower()


def emparejar(series, publicados, buscar=buscar_con_cache):
    """Decide por cada serie. `buscar` se inyecta para probar sin red."""
    for s in series:
        n = generar._normalizar(s["serie"])
        s["candidatos"] = []
        s["anilist"] = None
        s["seccion"] = None
        ya = publicados.get(n)
        if ya:
            s["estado"] = "ya-en-web"
            s["seccion"], s["publicado"], s["fichaId"] = ya
            continue
        try:
            resultados = buscar(s["serie"]) or []
        except Exception as e:  # red caida: se dice y se sigue con las demas
            s["estado"] = "error"
            s["error"] = str(e)
            continue
        prefiere_novela = _quiere_novela(s)
        for m in resultados:
            t = m.get("title") or {}
            sec = _seccion_de(m.get("format"))
            if sec is None:
                continue
            coincide = any(generar._normalizar(x) == n for x in (t.get("romaji"), t.get("english"), t.get("native")))
            s["candidatos"].append({
                "id": m["id"], "titulo": t.get("english") or t.get("romaji"),
                "formato": m.get("format"), "seccion": sec, "coincide": coincide,
            })
        if not s["candidatos"]:
            s["estado"] = "sin-resultado"
            continue
        exactos = [c for c in s["candidatos"] if c["coincide"]]
        if prefiere_novela:
            exactos = [c for c in exactos if c["seccion"] == "lightnovel"] or exactos
        if len(exactos) == 1:
            s["estado"] = "seguro"
            s["anilist"] = exactos[0]
            s["seccion"] = exactos[0]["seccion"]
        else:
            s["estado"] = "dudoso"
    return series


# ------------------------------------------------------------- informe


def imprimir(series):
    grupos = {"ya-en-web": [], "seguro": [], "dudoso": [], "sin-resultado": [], "error": []}
    for s in series:
        grupos.setdefault(s["estado"], []).append(s)

    def tomos(s):
        t = s["tomos"]
        if not t:
            return f"{s['filas']} fila(s)"
        return f"{len(t)} tomo(s): {t[0]}–{t[-1]}" if len(t) > 1 else f"tomo {t[0]}"

    print(f"\n  {len(series)} series en la exportacion de Whakoom\n")
    if grupos["ya-en-web"]:
        print(f"  YA EN LA WEB ({len(grupos['ya-en-web'])}):")
        for s in grupos["ya-en-web"]:
            print(f"    {s['serie']}  ->  {s['seccion']} ficha {s['fichaId']}  ({tomos(s)})")
    if grupos["seguro"]:
        print(f"\n  SEGUROS ({len(grupos['seguro'])}) — un solo candidato y el titulo coincide:")
        for s in grupos["seguro"]:
            a = s["anilist"]
            print(f"    {s['serie']}  ->  --seccion {s['seccion']} --anilist-id {a['id']}  [{a['formato']}]  ({tomos(s)})")
    if grupos["dudoso"]:
        print(f"\n  DUDOSOS ({len(grupos['dudoso'])}) — elige a mano y lanza generar.py:")
        for s in grupos["dudoso"]:
            print(f"    {s['serie']}  ({tomos(s)})")
            for c in s["candidatos"][:5]:
                marca = "=" if c["coincide"] else " "
                print(f"      {marca} --seccion {c['seccion']:<10} --anilist-id {c['id']:<8} {c['titulo']}  [{c['formato']}]")
    if grupos["sin-resultado"]:
        print(f"\n  SIN RESULTADO EN ANILIST ({len(grupos['sin-resultado'])}):")
        for s in grupos["sin-resultado"]:
            print(f"    {s['serie']}  ({tomos(s)})")
    if grupos["error"]:
        print(f"\n  NO SE PUDO CONSULTAR ({len(grupos['error'])}):")
        for s in grupos["error"]:
            print(f"    {s['serie']}: {s['error']}")
    print()


def generar_seguros(series, con_ollama=False):
    hechos = []
    for s in series:
        if s["estado"] != "seguro":
            continue
        clave = s["seccion"]
        ficha = generar.construir_borrador_obra(s["anilist"]["id"], clave)
        if con_ollama:
            ficha, _ = generar.realzar_con_ollama(ficha)
        ruta, estado = generar.publicar_borrador(ficha, clave)
        print(f"  {s['serie']}: {estado}" + (f" ({ruta})" if ruta else ""))
        hechos.append(s["serie"])
    return hechos


def main():
    p = argparse.ArgumentParser(description="Importador de la coleccion de Whakoom (xlsx)")
    p.add_argument("xlsx", help="la exportacion de Whakoom")
    p.add_argument("--hoja", type=int, help="numero de hoja (por defecto la primera)")
    p.add_argument("--columnas", help="forzar columnas: serie=Serie,numero=Numero,titulo=Titulo")
    p.add_argument("--datos", default=os.path.join(AQUI, "..", "public", "data"),
                   help="carpeta con manga.json y lightnovels.json")
    p.add_argument("--generar", action="store_true",
                   help="crear borradores (rama `borradores`) de los emparejamientos SEGUROS")
    p.add_argument("--ollama", action="store_true", help="con --generar, traducir la sinopsis")
    p.add_argument("--salida", help="donde dejar el JSON del emparejamiento")
    args = p.parse_args()

    forzadas = {}
    if args.columnas:
        for trozo in args.columnas.split(","):
            if "=" not in trozo:
                p.error(f"--columnas espera rol=Cabecera, no «{trozo}»")
            rol, nombre = trozo.split("=", 1)
            forzadas[rol.strip()] = nombre.strip()

    cabeceras, filas = leer_xlsx(args.xlsx, args.hoja)
    if not filas:
        print("El xlsx no tiene filas.", file=sys.stderr)
        sys.exit(1)
    roles = detectar_columnas(cabeceras, forzadas)
    print(f"# columnas: " + ", ".join(f"{rol}={cabeceras[i]!r}" for rol, i in roles.items()), file=sys.stderr)

    series = agrupar_series(cabeceras, filas, roles)
    series = emparejar(series, _titulos_publicados(args.datos))
    imprimir(series)

    salida = args.salida or os.path.join(AQUI, "work", "whakoom-emparejado.json")
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(series, f, ensure_ascii=False, indent=2)
    print(f"# emparejamiento guardado en {salida}", file=sys.stderr)

    if args.generar:
        print("\n  Generando borradores de los SEGUROS:")
        hechos = generar_seguros(series, con_ollama=args.ollama)
        print(f"\n  {len(hechos)} borrador(es). Revisalos en el panel (Borradores).\n")


if __name__ == "__main__":
    main()
