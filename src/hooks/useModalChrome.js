import { useEffect } from 'react';

// Contador en vez de un booleano: si algún día hay dos capas abiertas a la vez,
// la de dentro al cerrarse no debe devolverle el scroll al fondo.
let openModals = 0;
let restoreOverflow = '';

function lockScroll() {
  if (openModals === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openModals += 1;
}

function unlockScroll() {
  openModals = Math.max(0, openModals - 1);
  if (openModals === 0) document.body.style.overflow = restoreOverflow;
}

/**
 * Comportamiento común a todos los modales: cerrar con Escape y bloquear el
 * scroll del fondo mientras están abiertos. Antes no había ninguna de las dos
 * cosas — la única forma de salir era el ratón, y la página de detrás se movía.
 */
export function useModalChrome(onEscape) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    lockScroll();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
    };
  }, [onEscape]);
}
