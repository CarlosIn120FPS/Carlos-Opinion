import { useEffect, useState } from 'react';

// Las portadas se sirven desde CDNs ajenos (Crunchyroll, Netflix, MyAnimeList) y
// esas URLs llevan tokens que rotan. Cuando una caduca, antes quedaba el icono de
// imagen rota; ahora al menos se lee el título.
// Una portada puede ser una URL externa o un fichero propio en public/ (p.ej.
// "covers/anime-8.jpg"). Las relativas necesitan el prefijo de `base`, o darian
// 404 al compilar con `npm run build:pages`, que sirve desde /Carlos-Opinion/.
export const resolveSrc = (src) => {
  if (!src) return src;
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
};

const CoverImage = ({ src, alt, className = '', wrapperClassName = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const resolved = resolveSrc(src);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center text-sm p-4 min-h-[8rem] ${wrapperClassName} ${className}`}
        role="img"
        aria-label={`Portada no disponible: ${alt}`}
      >
        <span>
          <span className="block text-2xl mb-1" aria-hidden="true">
            🖼️
          </span>
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export default CoverImage;
