# Panel privado para rellenar fichas — idea de Carlos

> Anotado el 2026-09-02 al final de la sesión, tal y como lo describió. **No está
> construido**: esto es la especificación para retomarlo.

## Qué quiere

Una web (o aplicación) **aparte de la pública**, a la que **solo pueda entrar él**,
donde vayan apareciendo las fichas que el generador va dejando a medias, para
rellenarlas cuando le apetezca.

En sus palabras: *"ya que es una inteligencia artificial y son campos, y solamente
hay que rellenarlos"*.

El flujo que describe:

1. Barra lateral con las secciones **separadas**: anime, manga, novelas ligeras.
2. Dentro de una sección, la lista de títulos pendientes.
3. Pincha en uno concreto.
4. Le salen **los campos que tiene que rellenar**, y solo esos.
5. Los rellena. Como el contenido es JSON, sustituir lo de dentro es trivial.

## Por qué encaja

Es la pieza que le faltaba al generador. Hoy el circuito es:

```
generador → rama `borradores` → git fetch → promote.mjs → editar JSON a mano → push
```

Tres pasos de línea de comandos entre que la máquina deja el borrador y él escribe
su opinión. Y el cuello de botella real está medido: **`personalOpinionFinal` está
vacío en 8 de 8 fichas**. No es que no tenga opinión, es que el trámite pesa más que
la opinión.

Con el panel, el circuito sería:

```
generador → borrador → [panel: pincha, escribe, guarda] → publicado
```

## Lo que hay que decidir antes de construirlo

### 1. Dónde vive y cómo se protege

La web pública corre en un contenedor `read_only` cuyo contenido se borra y
reescribe (`rsync --delete`) en cada despliegue: **cualquier cosa que el panel
escriba ahí desaparece en el siguiente push**. Así que el panel no puede ser una
ruta más de la web actual. Opciones:

- **En Pavilion, servicio aparte** detrás de NPM con una *Access List* (ya se usa
  ese mecanismo para Sonarr, Radarr y compañía). Sujeto a la regla de <100 MB de RAM.
- **Solo en local**, arrancándolo cuando lo necesite (`npm run panel`). Cero
  superficie expuesta, cero autenticación que escribir, pero hay que estar en el PC.

### 2. Cómo escribe los cambios

La opción limpia: el panel tiene un clon de trabajo del repositorio, escribe el
JSON, commitea y hace push a `main`. El hook de siempre compila y publica. Así el
panel no es una vía paralela que se salta el control de versiones: es otro cliente
de git, con historial y `git revert` gratis.

### 3. Qué campos enseña

No todos. Los que la máquina no puede rellenar:

`category`, `rating`, `ratingFinal`, `personalOpinion`, `personalOpinionFinal`,
`doIRecommend`, `willReadSource`

Y los que el generador marca en `_meta._revisar` (`episodes`, `genres`,
`fullSynopsis`, `description`...) en un bloque aparte de "revisar lo que propuso la
máquina", visualmente distinto de "escribe lo tuyo".

### 4. Manga y novelas

Él lo dice explícitamente: **las secciones van separadas**. Y su modelo es una ficha
por medio: la misma obra puede estar en las tres, porque en cada una opina de una
cosa distinta. El panel tiene que reflejar eso, no unificarlo.

Hoy el generador solo produce borradores de anime. Para manga y novelas haría falta
una fuente equivalente (AniList sí tiene `MANGA`, así que es viable).

## Ideas relacionadas que ya estaban en el plan

De `integracion-jellyfin.md`, y que este panel absorbe o potencia:

- **Editor local de fichas** (propuesta 8): la misma idea, pero él la quiere como
  aplicación propia y accesible desde fuera del PC. Su versión es mejor.
- **Filtro "sin opinar"** (propuesta 6): sigue haciendo falta *en la web pública*,
  para que una ficha a medias no parezca terminada.
- **Botón "clonar a manga"**: copiar los campos comunes y crear la ficha hermana
  enlazada. Encaja de forma natural en el panel.
- **Diario de la ficha** (`notes: [{date, text}]`): el panel es el sitio donde
  escribir una nota suelta cuesta diez segundos en vez de dar pereza.

## Lo que NO debe hacer

- **Ni una palabra escrita por la IA en los campos de opinión.** El panel es para
  que escriba Carlos. La máquina propone datos objetivos; la voz es suya.
- **No exponerlo sin lista de acceso.** Es una herramienta de escritura sobre el
  repositorio: si entra alguien, edita la web.

---

# Ampliación: crítica episodio a episodio

> Segunda idea de Carlos, la misma noche. El panel no es solo para rellenar los
> huecos de una ficha: es donde escribe **mientras ve la serie**.

## Qué quiere

*"Si me veo un episodio, que me ponga: episodio ocho, opinión: lo que sea, rating:
lo que sea. Quiero hacer literalmente como críticas."*

Es decir: más tarjetas, y más cosas dentro de cada tarjeta. Según va viendo un anime,
va dejando **opinión y nota de cada capítulo**, no solo de la serie entera.

## Por qué esto es lo más valioso de todo lo apuntado

Los datos lo dicen: **`personalOpinionFinal` está vacío en 8 de 8 fichas**, y
`personalOpinion` en 4 de 8. No es falta de opinión. Es que *"escribe tu veredicto
definitivo sobre esta obra"* da pereza y se pospone para siempre, mientras que
*"acabo de ver el episodio 7 y esto ha sido una salvajada"* se escribe en diez
segundos.

Y resuelve un hueco real del formato actual: los animes en **"Viendo"** no tienen
dónde poner lo que uno va pensando sin comprometerse a un veredicto. Cuando termine
la serie, no parte de una página en blanco: parte de sus doce entradas.

## Forma propuesta

> **SUPERADO (2026-09-03).** El campo existe ya, pero se llama `entries` y sus
> claves son `season`/`episode`, `volume`/`chapter`, `text`, `rating`, `date`.
> **El panel debe escribir contra `docs/esquema-ficha.md`**, no contra el ejemplo
> de aquí abajo.

Un campo nuevo opcional, **solo se añade, nunca se reescribe**:

```json
"episodios": [
  { "ep": 8, "fecha": "2026-09-02", "rating": "9/10",
    "opinion": "La pelea del final es lo mejor de la temporada." }
]
```

Notas de diseño:

- **`ep` puede faltar.** A veces la nota es de la serie, no de un capítulo. Un campo
  suelto de "nota general con fecha" cubre el diario sin obligar a numerar.
- **`rating` opcional.** Muchas veces querrá comentar sin puntuar.
- **La fecha la pone el panel**, no él.
- Con temporadas: `"temporada": 2` junto a `ep`, o `"ep": "2x08"`. Decidir al
  implementar, mirando cómo lo escribe él de forma natural.

En la web pública esto puede ser un bloque desplegable dentro del modal
("**Mientras lo veía**"), y en la tarjeta un contador discreto: *"12 comentarios"*.

## La regla que no se negocia

**Aquí la IA no escribe nunca.** Ni una entrada, ni un resumen de las entradas, ni
una sugerencia de nota. Todo el valor de este campo es que son las palabras de Carlos
en el momento en que las pensó.

---

# Idea aparte: integración con Crunchyroll

> Tercera idea de la misma noche. Apuntada, pero es la más incierta de las tres.

## Qué quiere

Que lo que vaya viendo en Crunchyroll entre solo en la web: que se sepa qué anime
está viendo y por qué episodio va, y que eso alimente tanto la ficha como las
críticas por capítulo.

## Lo que hay que investigar antes de prometer nada

- **Crunchyroll no tiene API pública.** Existe la que usa su propia aplicación, y
  clientes no oficiales que la envuelven, pero eso es terreno movedizo: cambia sin
  aviso y puede chocar con sus condiciones de uso. **Hay que mirarlo antes de
  diseñar nada encima.**
- **Jellyfin sí lo tiene fácil.** Lleva el progreso de reproducción de serie y
  guarda qué episodios están vistos, y su API es pública y documentada. Para lo que
  ves en tu propio servidor, esto ya funciona hoy.

Así que lo sensato es partirlo:

1. **Primero Jellyfin**, que es viable ya y cubre lo que tienes descargado.
2. **Crunchyroll después**, si al investigarlo resulta razonable.

Merece la pena recordar un dato de hoy: de tus 8 fichas, **solo 3 están en
Jellyfin**. Escribes de series que no siempre guardas — que es justo el hueco que
cubriría Crunchyroll, y por eso la idea tiene sentido aunque sea la más difícil.
