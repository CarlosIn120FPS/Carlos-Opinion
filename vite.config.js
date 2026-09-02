import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// `base` es '/' porque la web se sirve en la raíz de su propio subdominio. Para
// GitHub Pages, que sirve desde /Carlos-Opinion/, está `npm run build:pages`, que
// lo sobrescribe con la opción --base de la línea de comandos.
//
// Todo lo demás se deriva de aquí: las rutas de public/data/*.json y el `basename`
// del router leen import.meta.env.BASE_URL. No hay ninguna ruta escrita a mano.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
