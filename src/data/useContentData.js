import { useEffect, useState } from 'react';
import { normalizeContent } from './normalize';

// Los datos ya no viven dentro del bundle: se piden en tiempo de ejecución desde
// public/data/*.json. Eso significa que para añadir un anime basta con editar el
// JSON en el servidor y recargar — sin `npm run build`, sin desplegar.
//
// BASE_URL lo pone Vite a partir de `base` en vite.config.js, así que esto
// funciona igual servido en la raíz de un dominio propio que en /Carlos-Opinion/
// de GitHub Pages, sin tocar nada.
const dataUrl = (file) => `${import.meta.env.BASE_URL}data/${file}`;

// Cache a nivel de módulo: cambiar de sección y volver no vuelve a pedir el JSON.
const cache = new Map();

const initialState = (id) =>
  cache.has(id)
    ? { id, status: 'ready', data: cache.get(id), error: null }
    : { id, status: 'loading', data: null, error: null };

export function useContentData(type) {
  const { id, file } = type;
  const [state, setState] = useState(() => initialState(id));

  useEffect(() => {
    if (cache.has(id)) {
      setState({ id, status: 'ready', data: cache.get(id), error: null });
      return;
    }

    const controller = new AbortController();
    setState({ id, status: 'loading', data: null, error: null });

    fetch(dataUrl(file), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar ${file} (HTTP ${response.status})`);
        return response.json();
      })
      .then((json) => {
        const data = normalizeContent(json);
        cache.set(id, data);
        setState({ id, status: 'ready', data, error: null });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error(`[${id}]`, error);
        setState({ id, status: 'error', data: null, error });
      });

    return () => controller.abort();
  }, [id, file]);

  // El inicializador de useState sólo corre una vez, así que al cambiar de sección
  // el estado guardado sigue siendo el de la anterior hasta que el efecto se
  // ejecuta. Ese frame pintaba las fichas del anime bajo el título del manga — y
  // con el layoutId de manga, que es justo la colisión que arreglamos en la
  // tarjeta. Derivamos el estado correcto en lugar de esperar al efecto.
  return state.id === id ? state : initialState(id);
}
