// La copia en GitHub de lo que se publica desde Pavilion.
//
// GitHub no forma parte del camino de publicación (deploy/README.md): es copia
// de seguridad. Pero hasta ahora sólo llegaba allí lo que Carlos empujaba desde
// el PC. Lo escrito desde el móvil vivía únicamente en Pavilion hasta que él lo
// traía y lo empujaba a mano. Si Pavilion muere entre medias, se pierde justo
// lo único que no se puede regenerar: sus opiniones.
//
// Así que el timer que publica también respalda: lo que hay en `origin/main`
// (lo publicado, nunca lo que aún no se ha empujado) se manda a `github/v2`.
//
// Puro: decide, no ejecuta. Lo comprueba scripts/test-panel.mjs.

/** Tras un fallo, no se vuelve a intentar hasta pasado esto. */
export const ESPERA_TRAS_FALLO_MS = 3 * 60 * 60 * 1000;

/**
 * ¿Toca empujar a GitHub?
 *
 *  - `publicado`:  rev de origin/main (lo que sirve la web).
 *  - `respaldado`: rev que GitHub ya tiene (la referencia local github/v2), o ''.
 *  - `fallo`:      { rev, cuando, motivo } del último intento fallido, o null.
 *  - `ahora`:      ms.
 *
 * Sin cambios no hay red: comparar dos referencias locales es gratis, y el
 * timer corre cada dos minutos. Y tras un fallo (la clave aún no registrada,
 * GitHub caído) se espera unas horas: si no, sería un intento y un aviso cada
 * dos minutos para siempre.
 */
export function decidirRespaldo({ publicado, respaldado, fallo, ahora }) {
  if (!publicado) return { empujar: false, motivo: 'nada publicado' };
  if (publicado === respaldado) return { empujar: false, motivo: 'al día' };
  if (fallo && Number.isFinite(fallo.cuando) && ahora - fallo.cuando < ESPERA_TRAS_FALLO_MS) {
    const minutos = Math.round((ESPERA_TRAS_FALLO_MS - (ahora - fallo.cuando)) / 60000);
    return { empujar: false, motivo: `falló hace poco; se reintenta en ${minutos} min` };
  }
  return { empujar: true, motivo: respaldado ? 'hay commits nuevos' : 'primera copia' };
}

/** Lo que se apunta tras un intento fallido. */
export const anotarFallo = (rev, ahora, motivo) => ({ rev, cuando: ahora, motivo: String(motivo ?? '').slice(0, 500) });

/** Lee lo apuntado; cualquier cosa rara cuenta como "sin fallo". */
export function leerFallo(texto) {
  try {
    const f = JSON.parse(texto);
    return f && typeof f.rev === 'string' && Number.isFinite(f.cuando) ? f : null;
  } catch {
    return null;
  }
}
