import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppRoutes from './routes.jsx'

// El basename sale de `base` en vite.config.js, igual que las rutas de los JSON.
// Ahora mismo es /Carlos-Opinion/ (GitHub Pages); cuando pase a '/' en el servidor
// propio, las rutas se adaptan solas sin tocar nada aquí.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
)
