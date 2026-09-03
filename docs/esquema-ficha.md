# Esquema de ficha — el diario por niveles

> Escrito el 2026-09-03, **antes** que el código, como pedía `VERSION-2.md`.
> Esto es el contrato: lo que el panel privado escribirá y lo que la web lee.
> Implementa la pieza 1 de `VERSION-2.md` y decide lo que `rediseno-fichas.md`
> dejó abierto.

## La decisión de fondo: lista plana, no anidada

`rediseno-fichas.md` dejaba abierta la pregunta:

> ¿Se cuelga el episodio de la temporada, o va plano con `"ep": "2x08"`?

**Va plano.** Una sola lista `entries` por ficha, donde cada entrada dice de qué
habla mediante unas claves *localizadoras*. La razón no es técnica, es cómo lo
describió Carlos:

> *"Si me veo un episodio, que me ponga: episodio ocho, opinión: lo que sea,
> rating: lo que sea."*

Eso es una entrada suelta que se añade al final. No es "busca la temporada 2,
y si no existe créala, y mete dentro el episodio 8". Anidar obligaría a crear el
contenedor antes de poder escribir, y pondría la opinión de una temporada y la de
un episodio en sitios distintos del JSON.

Con lista plana hay **una sola forma** y el nivel se deduce de qué claves trae:

| Claves presentes | De qué habla |
|---|---|
| `season` + `episode` | de ese episodio |
| solo `season` | de la temporada entera |
| ninguna | de la obra, o una nota suelta con fecha |

Y eso último resuelve gratis el caso que el propio documento pedía: *"`ep` puede
faltar. A veces la nota es de la serie, no de un capítulo."*

## La forma

```json
{
  "id": 2,
  "title": "Call of the Night",
  "rating": "8.5/10",
  "personalOpinion": "...",

  "entries": [
    {
      "id": "e-1757000000000",
      "date": "2026-09-03",
      "season": 2,
      "episode": 8,
      "rating": 9,
      "text": "La pelea del final es una barbaridad."
    },
    {
      "date": "2026-09-05",
      "season": 2,
      "rating": 8.5,
      "text": "Temporada más floja que la primera, pero el final lo arregla."
    },
    {
      "text": "Nota suelta: la banda sonora tira del anime entero."
    }
  ]
}
```

### Los campos

| Campo | Tipo | Obligatorio | Quién lo pone |
|---|---|---|---|
| `text` | cadena | **sí** (o `rating`) | Carlos |
| `rating` | número 0–10 | no | Carlos |
| `date` | `YYYY-MM-DD` | no | **el panel**, no él |
| `id` | cadena | no | el panel, para poder editar después |
| localizadores | número | no | Carlos |

Una entrada sin `text` y sin `rating` no es nada: se descarta al cargar.

### Los localizadores, por sección

Cada sección declara cómo se llaman sus niveles en `src/data/niveles.js`. Los
nombres de clave están en inglés como todo el resto del JSON (`title`, `rating`,
`personalOpinion`); el español vive en las etiquetas que se pintan.

| Sección | Nivel externo | Nivel interno |
|---|---|---|
| anime | `season` (Temporada) | `episode` (Episodio) |
| manga | `volume` (Volumen) | `chapter` (Capítulo) |
| novelas ligeras | `volume` (Volumen) | — |

Novelas tiene un solo nivel a propósito: se opina por volumen, no por capítulo.

## Lo que NO cambia

**`rating`, `ratingFinal`, `personalOpinion` y `personalOpinionFinal` se quedan
exactamente como están.** Son el nivel de obra, y son los únicos campos con
contenido real escrito a mano en las 10 fichas.

`rediseno-fichas.md` preguntaba si el nivel por episodio los hace sobrar. No: son
el veredicto del conjunto, y ya están escritos. `entries` **solo añade**. Cero
migración, cero riesgo de degradar lo que hay.

Consecuencia práctica: las 10 fichas de hoy siguen siendo válidas sin tocar ni una
coma, porque `entries` es opcional en todas.

## Cómo se ordena y se agrupa

Reglas, implementadas en `src/lib/entries.js` y verificadas con `npm test`
(`scripts/test-entries.mjs` para la lógica, `scripts/test-render.mjs` para lo que
se pinta — incluidos los tres modales montados de verdad):

1. Se ordena por nivel externo ascendente. Las entradas **sin** nivel externo van
   al final: son comentario general, no parte de la temporada 1.
2. Dentro de un grupo, la entrada de la temporada entera va **antes** que sus
   episodios. Primero el titular, luego el detalle.
3. Luego por nivel interno ascendente, luego por `date`, y a igualdad se respeta
   el orden del fichero. El orden es estable: dos entradas iguales nunca bailan.
4. **Solo se agrupa si hay más de un grupo.** Un anime de una temporada enseña
   una lista de episodios limpia, sin una cabecera "Temporada 1" que no distingue
   nada.

## Cómo se ve

- **Anime (cristal) y manga (viñeta):** bloque plegado por defecto. Doce entradas
  desplegadas serían la peor presentación del mejor contenido.
- **Novelas (libro):** siempre desplegado. Ese modal pagina con columnas CSS y
  solo recalcula las páginas al redimensionar, así que un plegable dejaría el
  contador de páginas mintiendo. Además, en un libro el diario paginando solo es
  justo lo que se quiere.
- **En la tarjeta:** un contador discreto, `12 notas`, y nada más.

## La regla que no se negocia

**La IA no escribe en `entries`.** Ni una entrada, ni un resumen de las entradas,
ni una nota sugerida. El generador rellena datos objetivos; esto es la voz de
Carlos y es todo el valor de la web.

Corolario para quien programe: en `public/data/*.json` no se escribe texto de
ejemplo. Las pruebas usan fichas sintéticas dentro del propio script de test.

## Lo que viene detrás

Este esquema es la pieza 1. La 2 es el panel privado (`panel-privado.md`), que
es quien debe escribir estas entradas — hasta que exista, se añaden a mano en el
JSON, que es exactamente la fricción que v2 elimina.
