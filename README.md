# Carlos' Opinion

La web donde Carlos comparte su opinión sobre los **animes**, **mangas** y **novelas
ligeras** que ha visto o leído, está viendo o leyendo, verá, o ha abandonado.

Construida con React, Vite, Tailwind CSS y Framer Motion.

![Carlos' Opinion](https://github.com/user-attachments/assets/83363d01-a76a-4b20-bafa-41e3cf931a64)

## 🎨 Características

- **Tres secciones con identidad propia**: cada medio tiene su propio lenguaje visual
  - *Anime* — cristal esmerilado (glassmorphism)
  - *Manga* — viñeta de cómic, bordes negros y bocadillos
  - *Novela ligera* — libro paginado con columnas de texto y textura de papel
- **Categorías organizadas**: Visto/Leído, Viendo/Leyendo, No visto/No leído, Abandonado
- **URLs reales**: cada sección y cada ficha tienen su dirección, el botón atrás
  funciona y puedes enlazar directamente a una opinión concreta
- **Buscador y filtrado** por título y categoría
- **Tema claro y oscuro**, respetando la preferencia del sistema
- **Columnas configurables** (1–6), ajustadas automáticamente al ancho de pantalla
- **Animaciones** con Framer Motion, con modo elástico opcional
- **Datos fuera del bundle**: el contenido son JSON que se cargan en tiempo de
  ejecución, así que añadir una ficha no requiere recompilar

## 🚀 Instalación y Uso

### Requisitos previos
- Node.js 18 o superior
- npm

### Instalación

```bash
git clone https://github.com/CarlosIn120FPS/Carlos-Opinion.git
cd Carlos-Opinion

npm install
npm run dev          # desarrollo -> http://localhost:5173/
npm run build        # producción -> dist/  (base = /)
npm run build:pages  # producción para GitHub Pages (base = /Carlos-Opinion/)
npm run preview      # sirve dist/ tal cual se desplegará
npm run lint
```

## ✏️ Añadir contenido

Todo el contenido vive en `public/data/*.json`. **No hay que tocar código.**

```
public/data/anime.json
public/data/manga.json
public/data/lightnovels.json
```

Cada fichero tiene la forma `{ "categories": [...], "items": [...] }`. Para añadir una
ficha, copias otra dentro de `items` y cambias los valores.

👉 **Los campos, las reglas y los errores típicos están en
[CUSTOMIZATION_GUIDE.md](CUSTOMIZATION_GUIDE.md).**

Como los JSON se sirven como ficheros estáticos, también se pueden editar
directamente en el servidor sin recompilar ni desplegar (acordándose de replicar el
cambio en el repositorio).

## 🔗 Rutas

| Ruta | Qué muestra |
|---|---|
| `/` | Redirige a `/anime` |
| `/anime` | Sección de anime |
| `/manga` | Sección de manga |
| `/novelas` | Sección de novelas ligeras |
| `/anime/2` | Abre directamente la ficha con `id: 2` de anime |
| cualquier otra | Redirige a `/anime` |

Los slugs salen del campo `slug` de `src/data/contentTypes.js`: añadir una sección
nueva crea su ruta sola, sin tocar `src/routes.jsx`.

## 🛠️ Tecnologías Utilizadas

- **React 19** — biblioteca de UI
- **React Router 7** — rutas por sección y ficha
- **Vite 7** — build tool y dev server
- **Tailwind CSS 3** — CSS utility-first
- **Framer Motion** — animaciones
- **JavaScript ES6+**

## 📁 Estructura del Proyecto

```
Carlos-Opinion/
├── public/
│   └── data/
│       ├── anime.json           # CONTENIDO (editable sin recompilar)
│       ├── manga.json           # CONTENIDO
│       └── lightnovels.json     # CONTENIDO
├── src/
│   ├── components/
│   │   ├── ContentCard.jsx          # Tarjeta, común a los tres tipos
│   │   ├── CoverImage.jsx           # Portada con recambio si la URL falla
│   │   ├── AnimeModal.jsx           # Modal estilo cristal
│   │   ├── MangaModal.jsx           # Modal estilo viñeta
│   │   ├── LightNovelModal.jsx      # Modal estilo libro
│   │   └── PageNavigationModal.jsx  # Selector de sección
│   ├── data/
│   │   ├── contentTypes.js      # Registro de secciones + slugs (añadir una va aquí)
│   │   └── useContentData.js    # Carga y normalización de los JSON
│   ├── hooks/
│   │   └── useModalChrome.js    # Escape + bloqueo de scroll de los modales
│   ├── lib/
│   │   ├── opinionFields.js     # Lógica compartida de ratings y opiniones
│   │   └── storage.js           # Acceso tolerante a localStorage
│   ├── App.jsx                  # Componente principal (lee sección y ficha de la URL)
│   ├── routes.jsx               # Tabla de rutas
│   ├── index.css                # Tailwind
│   └── main.jsx                 # Punto de entrada + BrowserRouter
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

## ➕ Añadir una sección nueva

1. `public/data/loquesea.json` con la misma forma.
2. Un modal en `src/components/`.
3. Una entrada en `src/data/contentTypes.js`.

El menú, los filtros y el buscador salen del registro; `App.jsx` no se toca.

## 🌐 Despliegue

Se autoaloja en el homelab, en el nodo **Pavilion** (el que va 24/7), detrás de
Nginx Proxy Manager.

```bash
git push casa main      # Pavilion compila y publica (~1 min)
git push github main    # copia de seguridad
```

**GitHub no interviene en el hosting**: es solo el sitio del que descargar el
código si algún día hace falta. Todo el despliegue ocurre dentro de la red local.

👉 **Detalle completo en [deploy/README.md](deploy/README.md)**

- `deploy/post-receive` — el hook que compila y publica al recibir el push
- `deploy/docker-compose.yml` — contenedor `nginx:alpine` (~2 MB de RAM)
- `deploy/nginx.conf` — `try_files` y política de caché

`base` vale `/` por defecto (servidor propio, en la raíz de un subdominio). Tanto
las rutas de los JSON como el `basename` del router se derivan de él, así que no
hay ninguna ruta escrita a mano. Para GitHub Pages: `npm run build:pages`.

Al haber rutas de verdad, el servidor debe devolver `index.html` para cualquier ruta
que no sea un fichero (`try_files $uri $uri/ /index.html`), o entrar directo a
`/anime` dará 404. Ya está en la configuración de nginx incluida.

## 🎨 Paleta de Colores

- **Acentos**: púrpura (`purple-400`–`purple-500`) y azul (`blue-400`–`blue-500`)
- **Tema oscuro**: fondo `#0f172a`, superficies `gray-800`
- **Tema claro**: fondo blanco, superficies con borde `gray-200`

## 📝 Licencia

Este proyecto está bajo la Licencia Apache 2.0. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

Carlos - [@CarlosIn120FPS](https://github.com/CarlosIn120FPS)
