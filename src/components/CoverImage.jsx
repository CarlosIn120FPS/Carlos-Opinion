import { useEffect, useState } from 'react';

// Las portadas se sirven desde CDNs ajenos (Crunchyroll, Netflix, MyAnimeList) y
// esas URLs llevan tokens que rotan. Cuando una caduca, antes quedaba el icono de
// imagen rota; ahora al menos se lee el título.
const CoverImage = ({ src, alt, className = '', wrapperClassName = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

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
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export default CoverImage;
