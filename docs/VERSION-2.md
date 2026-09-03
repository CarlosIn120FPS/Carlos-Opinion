# Carlos' Opinion v2

> Anotado el 2026-09-02, al cierre de la sesión. **Esto no es una lista de mejoras
> sueltas: es el marco.** Los detalles están en `panel-privado.md` y
> `rediseno-fichas.md`; este documento dice para qué.

## Lo que pidió Carlos

*"Quiero hacer una mejora tan sustancial que veas la otra y digas: esto tiene por lo
menos un año de diferencia, aunque no sea verdad."*

Y, dicho explícitamente: **no le importan las implicaciones**. Migrar los datos,
rehacer los tres modales, cambiar el esquema — todo eso está aceptado de antemano.
No hay que ir con pies de plomo ni proponer medias tintas por miedo a romper.

Lo único intocable son **sus datos**: las 10 fichas escritas a mano no se pierden ni
se degradan. Se migran.

## Qué hace que parezca de otro año

No es tener más funciones. Es que **cambia lo que la web es**.

| | v1 (hoy) | v2 |
|---|---|---|
| Qué es | Un catálogo con notas | **Un diario de lo que ve y lee**, que además cataloga |
| Cuándo escribes | Al terminar la obra | **Mientras la ves**, capítulo a capítulo |
| Qué cuenta | Un veredicto | Cómo fue cambiando de opinión |
| Cómo se rellena | A mano, campo por campo | La máquina trae los datos; él solo opina |
| Dónde escribes | Editando un JSON | Un panel propio, desde cualquier sitio |
| De dónde sale el contenido | De su memoria | De AniList, Jellyfin y Whakoom |

La prueba de que v1 se queda corta está en sus propios datos: **`personalOpinionFinal`
está vacío en 8 de 8 fichas**. No es que no tenga opinión. Es que el único hueco que
le ofrece la web es *"escribe tu veredicto definitivo"*, y eso da pereza siempre.

v2 le pregunta otra cosa: *"¿qué te ha parecido el episodio 7?"* Eso se contesta en
diez segundos, y al terminar la serie hay doce entradas donde antes había un hueco.

**Ese es el salto.** Lo demás son consecuencias.

## Las cinco piezas

Por orden de lo que sostiene a lo demás:

1. **Rediseño del modelo de ficha** → `rediseno-fichas.md` — **HECHO (2026-09-03)**
   Opinar por niveles: la obra, cada temporada, cada episodio; cada volumen, cada
   capítulo. Es la base: sin esto, el panel no tiene dónde escribir.
   El esquema resultante está en `esquema-ficha.md`; se decidió lista **plana** con
   localizadores, y los campos de opinión de siempre se quedaron intactos.

2. **Panel privado** → `panel-privado.md` — **HECHO y ALOJADO (2026-09-03)**
   Corre en Pavilion (`panel/README.md`, `deploy/panel/README.md`). Además de los
   campos, enseña los borradores del generador y los publica.
   Su herramienta de escritura. Barra lateral por secciones, pinchas un título y
   salen solo los campos que te tocan. Es lo que convierte "rellenar un JSON" en
   "escribir dos frases".

3. **Generador de fichas** → `generador/README.md` — **COMPLETO (2026-09-03)**
   Trae los datos objetivos para que él no transcriba nada. Cubre las tres
   secciones: `--seccion anime|manga|lightnovel`.

4. **Fuentes de lo que consume** → Jellyfin (hecho). **Crunchyroll: NO VIABLE**,
   sus condiciones prohíben el acceso automatizado; la vía que sí sirve es usar
   AniList como buzón y leerlo desde el navegador del panel (aparcado: Carlos
   tiene cuenta pero no la usa). **Whakoom: sin API y raspar prohibido**; sólo
   por exportación manual, que él tiene por ser PRO.

5. **La web pública, rehecha** → las mejoras del análisis en
   `integracion-jellyfin.md`: buscador que busque de verdad, navegación visible en
   móvil, la nota en la tarjeta, fichas hermanas enlazadas.

## Cómo abordarlo mañana

El orden importa, porque hay dependencias reales:

```
1. Modelo de datos          ← HECHO: docs/esquema-ficha.md
2. Panel privado            ← HECHO: alojado en Pavilion, con vista de borradores
3. Generador de fichas      ← HECHO: --seccion anime|manga|lightnovel
4. Fuentes de lo que consume← HECHO: Jellyfin, AniList y Whakoom (xlsx, calibrado)
5. Web pública rehecha      ← HECHO: hermanas, portadas locales, OG, rediseño
```

Todo lo de arriba se cerró el 3 de septiembre de 2026; el diario de ese día,
con el porqué y el commit de cada cosa, está en
[`registro-2026-09-03.md`](registro-2026-09-03.md).

**Lo que falta de verdad, contrastado contra el código, está en
[`estado-v2.md`](estado-v2.md).** Ese es el documento que hay que mirar antes de
decidir qué se hace ahora; éste dice para qué.

## Lo que NO cambia en v2

- **La voz es suya.** La IA rellena datos objetivos: títulos, géneros, episodios,
  enlaces. **No escribe opiniones, ni notas, ni resúmenes de sus opiniones**, a
  ningún nivel. Es lo único que la web no puede sacar de ninguna base de datos, y es
  todo su valor.
- **Sin comentarios ni votos de visitantes.** Una nota media de desconocidos al lado
  de su 10/10 convierte esto en un MyAnimeList peor.
- **El alojamiento sigue siendo suyo.** GitHub es copia de seguridad, nunca parte del
  camino.
- **La web pública sigue siendo estática.** El panel escribe en el repositorio, y el
  despliegue de siempre publica. Nada de un backend con base de datos sirviendo la
  web.

## Una advertencia para el yo de mañana

Este documento describe un proyecto grande y Carlos ha dicho que quiere hacerlo
entero. Aun así:

- **Empezar por el esquema** y validarlo contra sus 10 fichas reales antes de
  construir nada encima. Es lo mismo que se hizo con el generador —calibrarlo contra
  lo escrito a mano— y ahí salieron tres errores que de otro modo se habrían
  arrastrado.
- **Nada de reescribir por reescribir.** Los tres modales tienen identidad propia
  (cristal, viñeta, libro) y eso es de lo mejor que tiene la web. v2 cambia lo que
  muestran, no su carácter.
