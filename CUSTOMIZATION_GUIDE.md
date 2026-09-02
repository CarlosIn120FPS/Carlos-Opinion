# Guía de Personalización — Carlos' Opinion

Todo el contenido de la web vive en tres ficheros JSON:

```
public/data/anime.json
public/data/manga.json
public/data/lightnovels.json
```

**Ya no hay que tocar código ni recompilar para añadir una ficha.** Antes los datos
eran módulos JavaScript que se empaquetaban dentro del bundle; ahora la web los pide
al arrancar, así que basta con editar el JSON y recargar la página.

---

## Las dos formas de añadir contenido

### A) En el servidor (rápida, sin compilar)

Edita directamente el JSON dentro de la carpeta que sirve el servidor web:

```bash
nano /var/www/carlos-opinion/data/anime.json
```

Guardas, recargas el navegador (Ctrl+F5 para saltarte la caché) y ya está.

> ⚠️ Este cambio **no** vuelve al repositorio de GitHub. Acuérdate de replicarlo en
> `public/data/` del repo, o el siguiente despliegue lo pisará.

### B) En el repositorio (la buena para que no se pierda)

Edita `public/data/anime.json`, haz commit y despliega. Es la que mantiene GitHub
como fuente de verdad.

---

## Añadir un anime

Abre `public/data/anime.json`. Tiene esta forma:

```json
{
  "categories": ["Visto", "Viendo", "No visto", "Abandonado"],
  "items": [ ... aquí van las fichas ... ]
}
```

Copia una ficha existente dentro de `items`, pégala y cambia los valores:

```json
{
  "id": 9,
  "title": "Título en español o inglés",
  "japaneseTitle": "Título japonés (日本語)",
  "category": "Visto",
  "image": "https://.../portada.jpg",
  "description": "Una o dos frases. Es lo que se ve en la tarjeta.",
  "genres": ["Romance", "Comedia"],
  "fullSynopsis": "La sinopsis larga, para el modal.",
  "episodes": "1 temporada/12 episodios",
  "hasManga": true,
  "hasLightNovel": false,
  "willReadSource": "Sí, voy a leerme el manga.",
  "doIRecommend": "Sí, mucho.",
  "platforms": ["Crunchyroll", "Netflix"],
  "languages": ["Japonés", "Español"],
  "rating": "8.5/10",
  "ratingFinal": "9/10",
  "personalOpinion": "Lo que pensaba mientras lo veía.",
  "personalOpinionFinal": "Lo que pienso al terminarlo.",
  "openings": [
    { "name": "Nombre del opening - Artista", "url": "https://youtu.be/..." }
  ],
  "endings": [
    { "name": "Nombre del ending - Artista", "url": "https://youtu.be/..." }
  ]
}
```

### Reglas que importan

- **`id` tiene que ser único dentro de ese fichero** (no entre ficheros: el manga y
  el anime pueden tener los dos un `id: 1`). El orden en pantalla se ordena por `id`,
  no por la posición en el JSON.
- **`category` tiene que coincidir exactamente** con una de las de `categories`,
  tildes incluidas. Si escribes una que no está en la lista, la ficha se muestra
  igualmente en una sección propia al final — pero seguramente sea una errata.
- **Comas**: JSON no admite coma después del último elemento de una lista o del
  último campo de un objeto. Es el fallo número uno al editar a mano.
- **Comillas dobles siempre**, tanto en las claves como en los textos. Si tu texto
  lleva comillas dentro, escápalas: `\"así\"`.

### Campos opcionales

Puedes dejar cualquier campo en `""` o quitarlo directamente. Si un campo está
vacío, esa fila no se pinta.

Los pares de opinión funcionan así:

| Tienes | Se muestra |
|---|---|
| `rating` y `ratingFinal` | "Rating (mientras lo veo)" y "Rating final" |
| solo `ratingFinal` | "Rating" a secas |
| solo `rating` | "Rating (mientras lo veo)" |
| ninguno | nada |

Igual con `personalOpinion` / `personalOpinionFinal`.

---

## Añadir un manga o una novela ligera

Mismo procedimiento con `manga.json` o `lightnovels.json`. Cambian algunos campos:

| Campo | anime | manga | novela |
|---|:--:|:--:|:--:|
| `episodes` | ✅ | — | — |
| `chapters` / `volumes` | — | ✅ | `volumes` |
| `author` | — | ✅ | ✅ |
| `illustrator` | — | — | ✅ |
| `hasAnime` | — | ✅ | ✅ |
| `hasManga` | ✅ | — | ✅ |
| `hasLightNovel` | ✅ | — | — |
| `openings` / `endings` | ✅ | — | — |
| `physicalStores` | — | ✅ | ✅ |

### Tiendas físicas (`physicalStores`)

Va anidado en tres niveles: tienda → idioma → volúmenes.

```json
"physicalStores": [
  {
    "name": "Amazon",
    "languages": [
      {
        "language": "Español",
        "volumes": [
          { "name": "Volumen 1", "url": "https://www.amazon.es/dp/..." },
          { "name": "Volumen 2", "url": "https://www.amazon.es/dp/..." }
        ]
      }
    ]
  }
]
```

---

## Añadir una sección nueva (películas, doujinshi...)

1. Crea `public/data/peliculas.json` con la misma forma (`categories` + `items`).
2. Crea el modal en `src/components/`.
3. Añade una entrada en `src/data/contentTypes.js`, con su `slug` (el trozo de URL).

Eso es todo — el menú de navegación, los filtros, el buscador y **la ruta**
(`/peliculas`, `/peliculas/1`) salen solos del registro. No hay que tocar `App.jsx`
ni `src/routes.jsx`.

---

## Cambiar los estilos

Los colores son clases de [Tailwind](https://tailwindcss.com/docs). Los degradados
morado→azul de la cabecera y los botones están en `src/App.jsx`; cada modal tiene su
propia identidad visual y se toca en su fichero:

| Fichero | Estilo |
|---|---|
| `src/components/AnimeModal.jsx` | Cristal esmerilado (*glassmorphism*) |
| `src/components/MangaModal.jsx` | Viñeta de cómic, bordes negros |
| `src/components/LightNovelModal.jsx` | Libro con columnas y textura de papel |

---

## Ver los cambios

```bash
npm install      # solo la primera vez
npm run dev      # http://localhost:5173/
```

El servidor recarga solo al guardar. Si editas un JSON de `public/data/` y no ves el
cambio, recarga con Ctrl+F5.

---

## Problemas comunes

| Síntoma | Causa casi siempre |
|---|---|
| "No se pudieron cargar los datos de esta sección" | JSON mal formado. Pégalo en [jsonlint.com](https://jsonlint.com/) y te dice la línea. |
| Una ficha no aparece | `category` mal escrita, o estás con un filtro puesto. |
| Sale un recuadro gris con el título en vez de la portada | La URL de `image` ya no responde. Cámbiala. |
| El orden no es el que esperas | Se ordena por `id`, no por la posición en el fichero. |
| Cambié el JSON en el servidor y al desplegar se perdió | Es lo esperado: replícalo también en el repo. |
