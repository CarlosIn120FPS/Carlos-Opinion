# Carlos' Experience - Galería de Anime

Una galería elegante y futurista de animes con diseño glassmorphism y estética científica, construida con React, Tailwind CSS y Framer Motion.

![Carlos' Experience](https://github.com/user-attachments/assets/83363d01-a76a-4b20-bafa-41e3cf931a64)

## 🎨 Características

- **Diseño Glassmorphism**: Interfaz con efectos de cristal líquido, transparencias y desenfoque suave
- **Categorías organizadas**: Visto, Viendo, No visto, Abandonado
- **Filtrado dinámico**: Sistema de filtros para visualizar animes por categoría
- **Tarjetas interactivas**: Hover effects con animaciones suaves
- **Modal detallado**: Panel modal con información completa del anime
- **Animaciones fluidas**: Implementadas con Framer Motion
- **Diseño para PC**: Optimizado para pantallas de ordenador (no responsive)
- **Estética científica**: Diseño limpio y minimalista inspirado en experimentos de laboratorio

## 🚀 Instalación y Uso

### Requisitos previos
- Node.js 16 o superior
- npm o yarn

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/CarlosIn120FPS/Carlos-Experience.git

# Navegar al directorio
cd Carlos-Experience

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

## ✏️ Personalización de Datos

Todos los datos de los animes se encuentran en el archivo `src/animeData.js`. Puedes modificar fácilmente:

### Estructura de datos del anime:

```javascript
{
  id: 1,                    // ID único
  title: "Nombre del Anime",
  category: "Visto",        // Categorías: "Visto", "Viendo", "No visto", "Abandonado"
  image: "URL de la imagen",
  description: "Descripción corta",
  genres: ["Género1", "Género2"],
  fullSynopsis: "Sinopsis extendida completa",
  episodes: 24,
  hasManga: true,          // true o false
  platforms: ["Plataforma1", "Plataforma2"],
  languages: ["Idioma1", "Idioma2"],
  rating: "9/10",
  personalOpinion: "Tu opinión personal"
}
```

### Cómo personalizar:

1. Abre el archivo `src/animeData.js`
2. Modifica los datos existentes o agrega nuevos animes siguiendo la estructura
3. Las imágenes pueden ser URLs externas o rutas locales en la carpeta `public`
4. Los cambios se reflejarán automáticamente en el navegador

## 🎯 Capturas de Pantalla

### Vista Principal con Filtros
![Vista Principal](https://github.com/user-attachments/assets/6b04435d-0d64-4b73-9785-68a724a1830f)

### Modal de Detalles
![Modal de Detalles](https://github.com/user-attachments/assets/afb376be-f92e-4004-8e28-8f0eb12fd258)

## 🛠️ Tecnologías Utilizadas

- **React** - Biblioteca de UI
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de CSS utility-first
- **Framer Motion** - Biblioteca de animaciones
- **JavaScript ES6+** - Lenguaje de programación

## 📁 Estructura del Proyecto

```
Carlos-Experience/
├── src/
│   ├── components/
│   │   ├── AnimeCard.jsx      # Componente de tarjeta de anime
│   │   └── AnimeModal.jsx     # Componente de modal
│   ├── animeData.js           # Datos de los animes (PERSONALIZABLE)
│   ├── App.jsx                # Componente principal
│   ├── index.css              # Estilos globales con Tailwind
│   └── main.jsx               # Punto de entrada
├── public/                    # Archivos estáticos
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

## 🎨 Paleta de Colores

- **Fondo**: Gradiente de índigo, púrpura y azul oscuro
- **Glassmorphism**: Blanco con opacidad 10-20%
- **Acentos**: Púrpura (purple-400 a purple-500) y Azul (blue-400 a blue-500)
- **Texto**: Blanco y tonos de gris claro

## 📝 Licencia

Este proyecto está bajo la Licencia Apache 2.0. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

Carlos - [@CarlosIn120FPS](https://github.com/CarlosIn120FPS)

