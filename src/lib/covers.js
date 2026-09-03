// Dónde está una portada. Una puede ser una URL externa o un fichero propio en
// public/ (p. ej. "covers/anime-8.jpg"). Las relativas necesitan el prefijo de
// `base`, o darían 404 al compilar con `npm run build:pages`, que sirve desde
// /Carlos-Opinion/.
//
// Vive aparte de CoverImage.jsx porque un fichero de componente sólo debe
// exportar componentes (react-refresh lo exige), y ContentCard también lo usa.
export const resolveSrc = (src) => {
  if (!src) return src;
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
};
