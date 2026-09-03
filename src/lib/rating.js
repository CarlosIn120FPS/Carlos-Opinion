// Las notas están escritas a mano y en varios formatos: "8.5/10", "9/10", "10/10",
// y las nuevas del diario son números pelados. Aquí se leen todas sin reescribir
// ninguna: el dato sigue siendo suyo, tal y como lo tecleó.
//
// Puro: sin React ni import.meta, probable desde node.

/** "8.5/10" -> 8.5 · "9,5" -> 9.5 · 7 -> 7 · cualquier otra cosa -> null */
export function parseRating(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  // Coge el primer número del texto: así "8.5/10" da 8.5 y no se lía con el 10.
  const match = value.replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * La nota que representa a una ficha. `ratingFinal` manda sobre `rating`: es el
 * veredicto al terminar, y en sus 7 pares siempre sube.
 */
export const itemRating = (item) =>
  parseRating(item?.ratingFinal) ?? parseRating(item?.rating);

/** Para pintarla: 9 -> "9", 8.5 -> "8.5". Sin ceros de relleno. */
export const showRating = (value) =>
  value === null || value === undefined ? '' : String(Number(value.toFixed(2)));

/**
 * ¿Está la ficha sin opinar? Es derivado, no hay campo nuevo: ni nota, ni opinión,
 * ni una sola entrada del diario. Hoy una ficha a medias se ve exactamente igual
 * de terminada que una completa, porque los bloques vacíos sencillamente no salen.
 */
export function isUnrated(item) {
  if (itemRating(item) !== null) return false;
  if (item?.personalOpinion || item?.personalOpinionFinal) return false;
  return !(Array.isArray(item?.entries) && item.entries.length > 0);
}
