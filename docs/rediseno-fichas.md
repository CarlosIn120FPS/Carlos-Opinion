# Rediseño del modelo de ficha — opinar por niveles

> Anotado el 2026-09-02. **Especificación, no implementación.**
> Es el cambio más grande de todos los apuntados: toca los datos, los tres modales
> y el panel privado a la vez.

## Qué quiere Carlos

Sus palabras: *"hay que rediseñar entero todos los modales. No me refiero a un
rediseño de cómo están hechos, sino un rediseño de todos los campos."*

Hoy una ficha tiene **una** opinión y **una** nota (más su variante "final"). Él
quiere opinar en **varios niveles a la vez**:

| Medio | Niveles sobre los que quiere opinar |
|---|---|
| Anime | la obra entera · **cada temporada** · **cada episodio** |
| Manga | la obra entera · **cada volumen o capítulo** |
| Novela ligera | la obra entera · **cada volumen** |

Ejemplo suyo: *"me leo un volumen de un manga, por ejemplo el uno, opino sobre cómo
me pareció el volumen, si me pareció soso o cómo."*

## La observación que hace el diseño fácil

Los tres medios son **la misma estructura con otros nombres**:

```
obra
└── nivel intermedio   (temporada | volumen | arco)
    └── unidad         (episodio  | capítulo)
```

Y eso encaja con la arquitectura que ya existe: `src/data/contentTypes.js` es un
registro donde cada sección declara sus particularidades. Bastaría con que declare
**cómo se llaman sus niveles**:

```js
anime:      { niveles: [{ clave: 'temporadas', singular: 'Temporada' },
                        { clave: 'episodios',  singular: 'Episodio'  }] },
manga:      { niveles: [{ clave: 'volumenes',  singular: 'Volumen'   },
                        { clave: 'capitulos',  singular: 'Capítulo'  }] },
lightnovel: { niveles: [{ clave: 'volumenes',  singular: 'Volumen'   }] },
```

Un solo componente de "lista de opiniones por nivel" sirve para los tres, y cada
modal lo viste con su estética (cristal, viñeta, libro). Igual que se hizo con
`opinionFields.js`, que quitó seis copias de la misma lógica.

## Forma propuesta de los datos

> **SUPERADO (2026-09-03).** Lo de abajo era la propuesta; la forma real está en
> **`docs/esquema-ficha.md`** y es distinta: una lista **plana** `entries` con
> claves localizadoras (`season`/`episode`, `volume`/`chapter`), no `temporadas`
> anidando `episodios`. Las cuatro decisiones que quedaban abiertas están
> resueltas allí. Se deja este apartado como registro del razonamiento.

Una sola figura, repetida en cada nivel. **Solo se añade, nunca se reescribe.**

```json
{
  "id": 8,
  "title": "...",
  "rating": "8.5/10",
  "personalOpinion": "...",

  "temporadas": [
    {
      "n": 1,
      "rating": "9/10",
      "opinion": "El mejor arranque del año.",
      "episodios": [
        { "n": 7, "fecha": "2026-09-02", "rating": "10/10",
          "opinion": "La pelea del final es una barbaridad." }
      ]
    }
  ]
}
```

Para manga y novelas, `volumenes` con la misma forma y `capitulos` dentro.

### Decisiones que hay que tomar antes de escribir código

1. **¿Se cuelga el episodio de la temporada, o va plano con `"ep": "2x08"`?**
   Anidado es más fiel; plano es más fácil de escribir a mano. Mirar cómo lo escribe
   él de forma natural antes de decidir.
2. **Los campos actuales.** `rating`/`ratingFinal` y
   `personalOpinion`/`personalOpinionFinal` ya expresan "mientras lo veía" contra
   "al terminar". ¿Se quedan como el nivel de obra, o el nivel por episodio los hace
   sobrar? **Cuidado: son los únicos campos con contenido real en las 10 fichas.**
   Cualquier cambio necesita migración, no un borrón.
3. **Qué se enseña en la web pública.** Doce entradas de episodio en fila es la peor
   presentación del mejor contenido. Probablemente un bloque plegado, y en la tarjeta
   un contador discreto.
4. **Los datos que ya hay.** Las 10 fichas actuales tienen que seguir siendo válidas
   sin tocarlas: todos los campos nuevos, opcionales.

## Por qué esto importa más de lo que parece

Los números de hoy: `personalOpinionFinal` está vacío en **8 de 8** fichas de anime.
`personalOpinion` en 4 de 8.

El formato actual solo admite el veredicto definitivo, y el veredicto definitivo da
pereza. Opinar por episodio o por volumen es lo que convierte la web de *"catálogo
con notas"* en *"lo que Carlos iba pensando mientras"*, que es lo que ningún
MyAnimeList tiene.

## La regla que no se negocia

**La IA no escribe en ninguno de estos campos, en ningún nivel.** Ni una entrada,
ni un resumen de las entradas, ni una nota sugerida. La máquina rellena datos
objetivos; estos campos son la voz de Carlos.

---

# Integración con Whakoom

> Cuarta idea de la noche. Whakoom es lo que usa para catalogar los mangas y novelas
> que tiene.

## Qué quiere

Que lo que tiene registrado en su cuenta de Whakoom entre en la web: qué mangas y
novelas posee y por qué volumen va, para no volver a teclear la colección.

## Lo que hay que investigar antes de prometer nada

Igual que con Crunchyroll, **no doy por hecho que se pueda**:

- ¿Tiene Whakoom API pública, o solo página de perfil?
- ¿Se puede exportar la colección (CSV, JSON) desde la propia cuenta? Si existe una
  exportación manual, eso ya resuelve el 90% sin depender de nada frágil.
- ¿Los volúmenes que lista se pueden emparejar con AniList/animethemes, o hay que
  hacerlo por título e ISBN?

**Primero mirar si hay exportación oficial.** Una descarga manual cada pocos meses
es infinitamente más robusta que raspar una web que puede cambiar mañana, y para una
colección que crece despacio es más que suficiente.

## Por qué encaja bien

El generador de hoy solo cubre **anime**, porque su fuente es Jellyfin. Manga y
novelas no tienen equivalente — y Whakoom sería exactamente eso: la fuente que dice
qué tiene. Con eso, `manga.json` y `lightnovels.json` dejarían de tener una ficha
cada uno.

Y el dato de `physicalStores` (esa estructura de tienda → idioma → volumen, con
cuatro niveles de anidamiento, que a mano no la hace nadie dos veces) es justo el
tipo de cosa que una fuente así podría rellenar.
