// Cómo se llaman los niveles sobre los que Carlos opina, por sección.
//
// Vive aparte de contentTypes.js a propósito: aquel importa los tres modales
// (.jsx), así que no se puede cargar desde un script de node. Esto sí, y es lo
// que hace que scripts/test-entries.mjs pueda comprobar el agrupado de verdad.
// El panel también lo lee tal cual (servido bajo /m/niveles.js).
//
// Añadir un nivel a una sección es una línea aquí. El componente que los pinta
// no sabe si son temporadas o volúmenes.
//
// Las claves van en inglés como el resto del JSON (title, rating,
// personalOpinion); el español es sólo lo que se pinta. Ver docs/esquema-ficha.md.
//
// El trozo de URL de cada sección (/anime, /manga, /novelas) NO va aquí: es de
// contentTypes.js, y tenerlo en dos sitios sería tener dos verdades.
export const ESQUEMA = {
  anime: {
    // Cómo se nombra la obra cuando otra sección habla de ella («¿Tiene anime?»),
    // y su género gramatical para el artículo y el pronombre.
    nombre: 'anime',
    genero: 'm',
    // El campo con el que las OTRAS secciones dicen que esta obra existe aquí.
    bandera: 'hasAnime',
    // Las secciones donde la misma obra puede tener otra ficha.
    hermanas: ['manga', 'lightnovel'],
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
    nombre: 'manga',
    genero: 'm',
    bandera: 'hasManga',
    // El mapa tiene que ser SIMÉTRICO: si novela dice que manga es su hermana,
    // manga tiene que decir lo mismo, porque enlazar escribe en las dos fichas
    // (y el test de related lo comprueba). Las fichas de manga no traían
    // hasLightNovel; ahora lo declara el orden de claves del panel y lo rellena
    // el generador, igual que ya hacía con hasAnime.
    hermanas: ['anime', 'lightnovel'],
    diaryTitle: 'Diario de lectura',
    countLabel: (n) => `${n} ${n === 1 ? 'nota' : 'notas'}`,
    levels: [
      { key: 'volume', label: 'Volumen' },
      { key: 'chapter', label: 'Capítulo' },
    ],
  },
  lightnovel: {
    nombre: 'novela ligera',
    genero: 'f',
    bandera: 'hasLightNovel',
    hermanas: ['anime', 'manga'],
    diaryTitle: 'Diario de lectura',
    countLabel: (n) => `${n} ${n === 1 ? 'nota' : 'notas'}`,
    // Un solo nivel a propósito: en novelas se opina por volumen, no por capítulo.
    levels: [{ key: 'volume', label: 'Volumen' }],
  },
};

export const esquemaDe = (typeId) => ESQUEMA[typeId] ?? ESQUEMA.anime;
