import { useEffect, useState } from 'react';
import { resolveSrc } from '../lib/covers';

// Las portadas viven en public/covers/ (antes colgaban de CDNs ajenos con tokens
// que rotan). Si una falla igualmente, en vez del icono de imagen rota se lee
// el título.

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
