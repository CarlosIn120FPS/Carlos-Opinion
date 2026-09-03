// El diario: la lista plana de opiniones por nivel de una ficha.
//
// Una sola forma de entrada sirve para los tres medios. El nivel del que habla se
// deduce de qué claves localizadoras trae (season/episode, volume/chapter), no de
// dónde esté anidada — porque no está anidada en ninguna parte. El razonamiento
// completo está en docs/esquema-ficha.md.
//
// Todo aquí es puro: ni React, ni import.meta, ni fetch. Se puede probar en node.

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Se queda con las entradas que dicen algo. Una sin texto y sin nota no es una
 * opinión: es una fila que el panel dejó a medias, y pintarla sería enseñar un
 * hueco con fecha.
 */
export function normalizeEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      (asText(entry.text) !== '' || asNumber(entry.rating) !== null),
  );
}

export const entryRating = (entry) => asNumber(entry?.rating);

// Las notas nuevas son números (9, 8.5); el "/10" es presentación, no dato.
export const formatRating = (value) => (value === null ? '' : `${value}/10`);

/**
 * Ordena y agrupa el diario de una ficha.
 *
 * Devuelve { total, grouped, groups }, donde cada grupo es
 * { key, label, items: [{ entry, label, key }] }.
 *
 * `grouped` es falso cuando sólo saldría un grupo: una cabecera que no distingue
 * nada es ruido. Un anime de una temporada enseña sus episodios y ya está.
 */
export function buildDiary(rawEntries, levels = []) {
  const entries = normalizeEntries(rawEntries);
  const outer = levels[0] ?? null;
  const inner = levels[1] ?? null;

  const decorated = entries.map((entry, index) => {
    const outerValue = outer ? asNumber(entry[outer.key]) : null;
    const innerValue = inner ? asNumber(entry[inner.key]) : null;
    return { entry, index, outerValue, innerValue };
  });

  // Un solo criterio para todo: sin nivel externo al final (son comentario
  // general, no parte de la temporada 1); dentro de cada temporada, la entrada
  // del conjunto antes que sus episodios; y a igualdad, el orden del fichero.
  decorated.sort((a, b) => {
    const aOuterMissing = a.outerValue === null ? 1 : 0;
    const bOuterMissing = b.outerValue === null ? 1 : 0;
    if (aOuterMissing !== bOuterMissing) return aOuterMissing - bOuterMissing;
    if ((a.outerValue ?? 0) !== (b.outerValue ?? 0)) {
      return (a.outerValue ?? 0) - (b.outerValue ?? 0);
    }
    const aHasInner = a.innerValue === null ? 0 : 1;
    const bHasInner = b.innerValue === null ? 0 : 1;
    if (aHasInner !== bHasInner) return aHasInner - bHasInner;
    if ((a.innerValue ?? 0) !== (b.innerValue ?? 0)) {
      return (a.innerValue ?? 0) - (b.innerValue ?? 0);
    }
    const aDate = asText(a.entry.date);
    const bDate = asText(b.entry.date);
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    return a.index - b.index;
  });

  const groups = [];
  const byKey = new Map();
  for (const record of decorated) {
    const key = record.outerValue === null ? '' : String(record.outerValue);
    if (!byKey.has(key)) {
      const group = {
        key,
        label: record.outerValue === null ? 'Notas generales' : `${outer.label} ${record.outerValue}`,
        items: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(record);
  }

  const grouped = groups.length > 1;

  for (const group of groups) {
    group.items = group.items.map(({ entry, index, outerValue, innerValue }) => ({
      entry,
      key: asText(entry.id) || `${group.key}-${innerValue ?? 'x'}-${index}`,
      label: entryLabel({ outer, inner, outerValue, innerValue, grouped }),
    }));
  }

  return { total: entries.length, grouped, groups };
}

function entryLabel({ outer, inner, outerValue, innerValue, grouped }) {
  if (inner && innerValue !== null) return `${inner.label} ${innerValue}`;
  if (outer && outerValue !== null) {
    // Bajo la cabecera "Temporada 2", repetirla sería redundante. Sin cabecera,
    // hace falta decir de qué temporada se habla.
    return grouped ? 'En conjunto' : `${outer.label} ${outerValue}`;
  }
  return '';
}
