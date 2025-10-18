# Guía de Personalización - Carlos' Experience

## 📝 Cómo Personalizar los Animes

### Ubicación del Archivo
El archivo con todos los datos se encuentra en: `src/animeData.js`

### Estructura de un Anime

```javascript
{
  id: 1,                    // ⚠️ IMPORTANTE: Debe ser único
  title: "Título del Anime",
  category: "Visto",        // Opciones: "Visto", "Viendo", "No visto", "Abandonado"
  image: "URL_de_la_imagen",
  description: "Descripción breve que aparece en la tarjeta",
  genres: ["Género1", "Género2", "Género3"],
  fullSynopsis: "Sinopsis completa que aparece en el modal",
  episodes: 24,             // Número de episodios
  hasManga: true,          // true si tiene manga, false si no
  platforms: ["Netflix", "Crunchyroll"],
  languages: ["Japonés", "Español", "Inglés"],
  rating: "9/10",          // Tu valoración
  personalOpinion: "Tu opinión personal sobre el anime"
}
```

### Pasos para Personalizar

#### 1. Cambiar imágenes de los animes existentes
```javascript
// Encuentra el anime que quieres modificar y cambia la URL
{
  id: 1,
  title: "Attack on Titan",
  image: "https://mi-imagen.com/attack-on-titan.jpg",  // ← Cambia aquí
  // ... resto de campos
}
```

#### 2. Modificar información
```javascript
{
  id: 1,
  title: "Attack on Titan",
  episodes: 87,              // ← Cambia el número
  rating: "10/10",           // ← Cambia la valoración
  personalOpinion: "Mi nueva opinión",  // ← Cambia la opinión
  // ... resto de campos
}
```

#### 3. Agregar un nuevo anime
```javascript
// Al final del array animeData, agrega:
{
  id: 9,                     // ⚠️ Usa un ID que no exista
  title: "Nuevo Anime",
  category: "Viendo",
  image: "URL_de_la_imagen",
  description: "Descripción corta",
  genres: ["Acción", "Aventura"],
  fullSynopsis: "Sinopsis completa...",
  episodes: 12,
  hasManga: false,
  platforms: ["Crunchyroll"],
  languages: ["Japonés", "Español"],
  rating: "8/10",
  personalOpinion: "Mi opinión..."
}
```

#### 4. Eliminar un anime
Simplemente borra todo el objeto del anime del array.

### 💡 Consejos

1. **Imágenes**: Puedes usar:
   - URLs externas: `"https://ejemplo.com/imagen.jpg"`
   - Imágenes locales: Guárdalas en `public/images/` y usa `"/images/nombre.jpg"`

2. **Categorías**: Deben ser exactamente:
   - "Visto"
   - "Viendo"
   - "No visto"
   - "Abandonado"

3. **IDs**: Asegúrate de que cada anime tenga un ID único

4. **Géneros**: Puedes usar cualquier texto, algunos ejemplos:
   - Acción, Drama, Romance, Comedia, Thriller
   - Fantasía, Ciencia Ficción, Sobrenatural
   - Horror, Misterio, Psicológico
   - Shounen, Seinen, Slice of Life

## 🚀 Ver los Cambios

Después de modificar `src/animeData.js`:

1. Si el servidor está corriendo (`npm run dev`), los cambios se verán automáticamente
2. Si no está corriendo, inicia el servidor con `npm run dev`
3. Abre http://localhost:5173 en tu navegador

## 🎨 Personalizar Estilos

### Colores del Fondo
En `src/index.css` (línea con el gradiente):
```css
/* Modifica los colores aquí */
background: linear-gradient(to bottom right, #312e81, #581c87, #1e3a8a);
```

### Colores de los Botones
En `src/App.jsx`, busca las clases de los botones y modifica:
```javascript
className="bg-gradient-to-r from-purple-500 to-blue-500"
// Cambia purple-500 y blue-500 por otros colores de Tailwind
```

## ❓ Problemas Comunes

**Problema**: Los cambios no se ven
- **Solución**: Asegúrate de guardar el archivo y que el servidor esté corriendo

**Problema**: Error después de agregar un anime
- **Solución**: Verifica que el ID sea único y que la sintaxis sea correcta (comas, comillas, etc.)

**Problema**: Las imágenes no cargan
- **Solución**: Verifica que las URLs sean correctas y accesibles
