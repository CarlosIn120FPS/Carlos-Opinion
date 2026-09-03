// Cómo se llaman los niveles sobre los que Carlos opina, por sección.
//
// Vive aparte de contentTypes.js a propósito: aquel importa los tres modales
// (.jsx), así que no se puede cargar desde un script de node. Esto sí, y es lo
// que hace que scripts/test-entries.mjs pueda comprobar el agrupado de verdad.
//
// Añadir un nivel a una sección es una línea aquí. El componente que los pinta
// no sabe si son temporadas o volúmenes.
//
// Las claves van en inglés como el resto del JSON (title, rating,
// personalOpinion); el español es sólo lo que se pinta. Ver docs/esquema-ficha.md.
export const ESQUEMA = {
  anime: {
    // Deliberadamente distinto de "Rating (mientras lo veo)", que es el campo de
    // obra de toda la vida. Son dos cosas y no pueden llamarse igual.
    diaryTitle: 'Diario de visionado',
    countLabel: (n) => `${n} ${n === 1 ? 'nota' : 'notas'}`,
    levels: [
      { key: 'season', label: 'Temporada' },
      { key: 'episode', label: 'Episodio' },
    ],
  },
  manga: {
    diaryTitle: 'Diario de lectura',
    countLabel: (n) => `${n} ${n === 1 ? 'nota' : 'notas'}`,
    levels: [
      { key: 'volume', label: 'Volumen' },
      { key: 'chapter', label: 'Capítulo' },
    ],
  },
  lightnovel: {
    diaryTitle: 'Diario de lectura',
    countLabel: (n) => `${n} ${n === 1 ? 'nota' : 'notas'}`,
    // Un solo nivel a propósito: en novelas se opina por volumen, no por capítulo.
    levels: [{ key: 'volume', label: 'Volumen' }],
  },
};

export const esquemaDe = (typeId) => ESQUEMA[typeId] ?? ESQUEMA.anime;
