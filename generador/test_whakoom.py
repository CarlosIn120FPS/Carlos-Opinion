#!/usr/bin/env python3
"""Comprueba el importador de Whakoom sin red: python3 generador/test_whakoom.py

Construye un xlsx minimo con zipfile (con cadenas compartidas, cadenas en linea,
numeros y celdas vacias en medio) y lo pasa por el lector, la deteccion de
columnas, el agrupado en series y el emparejamiento con una busqueda simulada.
"""

import io
import os
import sys
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import whakoom  # noqa: E402


def xlsx_minimo(cabeceras, filas):
    """Un xlsx de verdad (para Excel tambien), con la mitad de las cadenas en
    sharedStrings y la otra mitad en linea, y sin celda para los vacios."""
    compartidas = []

    def celda(ref, valor, en_linea):
        if valor == "" or valor is None:
            return ""  # las vacias no van al XML: es lo que hace Excel
        if isinstance(valor, (int, float)):
            return f'<c r="{ref}"><v>{valor}</v></c>'
        if en_linea:
            return f'<c r="{ref}" t="inlineStr"><is><t>{valor}</t></is></c>'
        compartidas.append(valor)
        return f'<c r="{ref}" t="s"><v>{len(compartidas) - 1}</v></c>'

    def fila_xml(n, valores):
        celdas = []
        for i, v in enumerate(valores):
            letra = chr(65 + i)
            celdas.append(celda(f"{letra}{n}", v, en_linea=(i % 2 == 1)))
        return f'<row r="{n}">{"".join(celdas)}</row>'

    todas = [cabeceras] + filas
    hoja = ('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetData>' + "".join(fila_xml(i + 1, f) for i, f in enumerate(todas)) + '</sheetData></worksheet>')
    ss = ('<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
          + "".join(f"<si><t>{c}</t></si>" for c in compartidas) + "</sst>")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/workbook.xml", "<workbook/>")
        z.writestr("xl/sharedStrings.xml", ss)
        z.writestr("xl/worksheets/sheet1.xml", hoja)
    return buf.getvalue()


CABECERAS = ["Título", "Número", "Serie", "Autor", "Editorial", "Tipo"]
FILAS = [
    ["Chainsaw Man #1", 1, "Chainsaw Man", "Tatsuki Fujimoto", "Norma", "Manga"],
    ["Chainsaw Man #3", 3, "Chainsaw Man", "Tatsuki Fujimoto", "Norma", "Manga"],
    ["Chainsaw Man #2", 2, "Chainsaw Man", "", "Norma", "Manga"],
    ["Mushoku Tensei 1", "", "", "Rifujin na Magonote", "Planeta", "Novela"],
    ["Spy x Family nº 4", "", "", "Tatsuya Endo", "Ivrea", "Manga"],
    ["Oyasumi Punpun 1", "", "", "Inio Asano", "", "Manga"],
    ["Cosa rarisima", "", "", "", "", ""],
]


def busqueda_simulada(titulo):
    n = whakoom.generar._normalizar(titulo)
    if n == "chainsaw man":
        return [{"id": 105778, "title": {"romaji": "Chainsaw Man", "english": "Chainsaw Man"}, "format": "MANGA"},
                {"id": 999, "title": {"romaji": "Chainsaw Man: Buddy Stories"}, "format": "NOVEL"}]
    if n == "spy x family":
        return [{"id": 108556, "title": {"romaji": "SPY×FAMILY", "english": "Spy x Family"}, "format": "MANGA"},
                {"id": 1234, "title": {"romaji": "SPY×FAMILY Family Portrait"}, "format": "NOVEL"}]
    if n == "oyasumi punpun":
        return [{"id": 1, "title": {"romaji": "Oyasumi Punpun", "english": "Goodnight Punpun"}, "format": "MANGA"},
                {"id": 2, "title": {"romaji": "Oyasumi Punpun"}, "format": "ONE_SHOT"}]
    return []


class Lector(unittest.TestCase):
    def setUp(self):
        self.ruta = os.path.join(os.path.dirname(__file__), "work", "_test.xlsx")
        os.makedirs(os.path.dirname(self.ruta), exist_ok=True)
        with open(self.ruta, "wb") as f:
            f.write(xlsx_minimo(CABECERAS, FILAS))

    def tearDown(self):
        os.remove(self.ruta)

    def test_lee_cabeceras_y_filas(self):
        cab, filas = whakoom.leer_xlsx(self.ruta)
        self.assertEqual(cab, CABECERAS)
        self.assertEqual(len(filas), len(FILAS))
        self.assertEqual(filas[0], ["Chainsaw Man #1", "1", "Chainsaw Man", "Tatsuki Fujimoto", "Norma", "Manga"])

    def test_las_celdas_vacias_no_desplazan(self):
        _, filas = whakoom.leer_xlsx(self.ruta)
        # La tercera fila no tiene autor: Editorial tiene que seguir en su sitio.
        self.assertEqual(filas[2][3], "")
        self.assertEqual(filas[2][4], "Norma")
        self.assertEqual(filas[6], ["Cosa rarisima", "", "", "", "", ""])

    def test_columna_a_indice(self):
        self.assertEqual(whakoom._columna_a_indice("A1"), 0)
        self.assertEqual(whakoom._columna_a_indice("Z9"), 25)
        self.assertEqual(whakoom._columna_a_indice("AB12"), 27)

    def test_no_es_xlsx(self):
        with open(self.ruta, "wb") as f:
            with zipfile.ZipFile(f, "w") as z:
                z.writestr("hola.txt", "no")
        with self.assertRaises(ValueError):
            whakoom.leer_xlsx(self.ruta)


class Columnas(unittest.TestCase):
    def test_detecta_por_nombre_sin_acentos(self):
        roles = whakoom.detectar_columnas(CABECERAS)
        self.assertEqual(roles["titulo"], 0)
        self.assertEqual(roles["numero"], 1)
        self.assertEqual(roles["serie"], 2)
        self.assertEqual(roles["autor"], 3)
        self.assertEqual(roles["tipo"], 5)

    def test_forzadas_mandan(self):
        roles = whakoom.detectar_columnas(["Nombre raro", "Cosa"], {"titulo": "Nombre raro", "numero": "cosa"})
        self.assertEqual(roles, {"titulo": 0, "numero": 1})

    def test_sin_titulo_revienta_con_pista(self):
        with self.assertRaises(ValueError) as cm:
            whakoom.detectar_columnas(["A", "B"])
        self.assertIn("--columnas", str(cm.exception))

    def test_forzar_columna_inexistente(self):
        with self.assertRaises(ValueError):
            whakoom.detectar_columnas(CABECERAS, {"titulo": "NoExiste"})


class Series(unittest.TestCase):
    def test_partir_titulo(self):
        self.assertEqual(whakoom.partir_titulo("Chainsaw Man #3"), ("Chainsaw Man", 3))
        self.assertEqual(whakoom.partir_titulo("Spy x Family nº 4"), ("Spy x Family", 4))
        self.assertEqual(whakoom.partir_titulo("Mushoku Tensei vol. 12"), ("Mushoku Tensei", 12))
        self.assertEqual(whakoom.partir_titulo("Oyasumi Punpun 1"), ("Oyasumi Punpun", 1))
        self.assertEqual(whakoom.partir_titulo("Cosa rarisima"), ("Cosa rarisima", None))
        # Un numero que forma parte del nombre y no es un tomo, con 4 cifras, se respeta.
        self.assertEqual(whakoom.partir_titulo("Steins;Gate 2020"), ("Steins;Gate 2020", None))

    def test_agrupa_por_serie_y_cuenta_tomos(self):
        roles = whakoom.detectar_columnas(CABECERAS)
        series = whakoom.agrupar_series(CABECERAS, [[str(x) for x in f] for f in FILAS], roles)
        por = {s["serie"]: s for s in series}
        self.assertEqual(por["Chainsaw Man"]["tomos"], [1, 2, 3])
        self.assertEqual(por["Chainsaw Man"]["autor"], "Tatsuki Fujimoto")
        # Sin columna de serie rellena: se saca del titulo.
        self.assertEqual(por["Mushoku Tensei"]["tomos"], [1])
        self.assertEqual(por["Mushoku Tensei"]["tipo"], "Novela")
        self.assertEqual(por["Spy x Family"]["tomos"], [4])
        self.assertIn("Cosa rarisima", por)


class Emparejar(unittest.TestCase):
    def series(self):
        roles = whakoom.detectar_columnas(CABECERAS)
        return whakoom.agrupar_series(CABECERAS, [[str(x) for x in f] for f in FILAS], roles)

    def test_decide_bien(self):
        publicados = {"mushoku tensei": ("lightnovel", "Mushoku Tensei: Jobless Reincarnation", 1)}
        series = whakoom.emparejar(self.series(), publicados, buscar=busqueda_simulada)
        por = {s["serie"]: s for s in series}
        # Ya publicada: ni se busca.
        self.assertEqual(por["Mushoku Tensei"]["estado"], "ya-en-web")
        self.assertEqual(por["Mushoku Tensei"]["fichaId"], 1)
        # Un candidato que coincide (el otro es una novela con otro titulo): seguro.
        self.assertEqual(por["Chainsaw Man"]["estado"], "seguro")
        self.assertEqual(por["Chainsaw Man"]["anilist"]["id"], 105778)
        self.assertEqual(por["Chainsaw Man"]["seccion"], "manga")
        # Coincide por english aunque el romaji lleve el signo raro.
        self.assertEqual(por["Spy x Family"]["estado"], "seguro")
        self.assertEqual(por["Spy x Family"]["anilist"]["id"], 108556)
        # Dos candidatos que coinciden (manga y one-shot): dudoso, NUNCA se elige solo.
        self.assertEqual(por["Oyasumi Punpun"]["estado"], "dudoso")
        self.assertEqual(len(por["Oyasumi Punpun"]["candidatos"]), 2)
        self.assertIsNone(por["Oyasumi Punpun"]["anilist"])
        # Nada en AniList.
        self.assertEqual(por["Cosa rarisima"]["estado"], "sin-resultado")

    def test_red_caida_no_tumba_el_resto(self):
        def rota(_):
            raise RuntimeError("timeout")
        series = whakoom.emparejar(self.series(), {}, buscar=rota)
        self.assertTrue(all(s["estado"] == "error" for s in series))
        self.assertIn("timeout", series[0]["error"])

    def test_novela_prefiere_novel(self):
        def buscar(_):
            return [{"id": 1, "title": {"romaji": "Obra"}, "format": "MANGA"},
                    {"id": 2, "title": {"romaji": "Obra"}, "format": "NOVEL"}]
        s = [{"serie": "Obra", "tomos": [1], "filas": 1, "tipo": "Novela ligera", "autor": "", "editorial": "", "isbn": []}]
        r = whakoom.emparejar(s, {}, buscar=buscar)[0]
        self.assertEqual(r["estado"], "seguro")
        self.assertEqual(r["seccion"], "lightnovel")
        s2 = [{"serie": "Obra", "tomos": [1], "filas": 1, "tipo": "", "autor": "", "editorial": "", "isbn": []}]
        self.assertEqual(whakoom.emparejar(s2, {}, buscar=buscar)[0]["estado"], "dudoso")

    def test_generar_solo_los_seguros(self):
        llamadas = []
        original = (whakoom.generar.construir_borrador_obra, whakoom.generar.publicar_borrador)
        whakoom.generar.construir_borrador_obra = lambda aid, clave: {"title": f"obra {aid}", "_clave": clave}
        whakoom.generar.publicar_borrador = lambda ficha, clave: (llamadas.append((ficha["title"], clave)) or ("ruta", "publicado"))
        try:
            series = whakoom.emparejar(self.series(), {}, buscar=busqueda_simulada)
            hechos = whakoom.generar_seguros(series)
        finally:
            whakoom.generar.construir_borrador_obra, whakoom.generar.publicar_borrador = original
        self.assertEqual(sorted(hechos), ["Chainsaw Man", "Spy x Family"])
        self.assertEqual(sorted(llamadas), [("obra 105778", "manga"), ("obra 108556", "manga")])


if __name__ == "__main__":
    unittest.main(verbosity=1)
