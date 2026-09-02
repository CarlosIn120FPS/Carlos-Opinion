import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import { DEFAULT_SLUG } from './data/contentTypes.js';

// Aparte de main.jsx a propósito: aquí no se toca `import.meta.env`, así que esta
// tabla de rutas se puede montar en una prueba fuera del navegador.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${DEFAULT_SLUG}`} replace />} />
      {/* Las dos rutas montan el mismo componente: la segunda solo añade qué ficha
          viene abierta, para poder enlazar a una opinión concreta. */}
      <Route path="/:sectionSlug" element={<App />} />
      <Route path="/:sectionSlug/:itemId" element={<App />} />
      <Route path="*" element={<Navigate to={`/${DEFAULT_SLUG}`} replace />} />
    </Routes>
  );
}
