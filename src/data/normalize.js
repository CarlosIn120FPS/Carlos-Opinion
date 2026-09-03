// Normalización de los JSON de contenido.
//
// Vive aparte de useContentData.js —que toca fetch e import.meta.env— para poder
// ejecutarlo desde node y comprobarlo contra las fichas reales. Mismo motivo por
// el que routes.jsx no depende del entorno.
//
// Un JSON editado a mano se va a romper alguna vez: una coma de más, un campo
// olvidado. Normalizamos aquí para que ningún componente tenga que defenderse y
// para que un fallo en una ficha no tumbe la página entera.

const toArray = (value) => (Array.isArray(value) ? value : []);
const toText = (value) => (typeof value === 'string' ? value : '');

export function normalizeItem(raw, index) {
  return {
    ...raw,
    id: raw?.id ?? `sin-id-${index}`,
    title: toText(raw?.title) || 'Sin título',
    description: toText(raw?.description),
    image: toText(raw?.image),
    category: toText(raw?.category),
    genres: toArray(raw?.genres),
    platforms: toArray(raw?.platforms),
    languages: toArray(raw?.languages),
    openings: toArray(raw?.openings),
    endings: toArray(raw?.endings),
    physicalStores: toArray(raw?.physicalStores),
    // El diario por niveles. Opcional en el JSON, siempre un array aquí, para
    // que ninguna ficha antigua obligue a los componentes a defenderse.
    entries: toArray(raw?.entries),
  };
}

export function normalizeContent(json) {
  const items = toArray(json?.items).map(normalizeItem);
  const declared = toArray(json?.categories).filter((c) => typeof c === 'string');
  // Una ficha con una categoría que no está en la lista sería invisible para
  // siempre. Preferimos enseñarla al final antes que tragárnosla en silencio.
  const extras = [...new Set(items.map((i) => i.category))].filter(
    (c) => c && !declared.includes(c),
  );
  return { categories: [...declared, ...extras], items };
}
