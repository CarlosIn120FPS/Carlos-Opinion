import { motion } from 'framer-motion';
import CoverImage from './CoverImage';
import { normalizeEntries } from '../lib/entries';
import { esquemaDe } from '../data/niveles';
import { itemRating, showRating } from '../lib/rating';

// Antes se llamaba AnimeCard, pero renderiza igual animes, mangas y novelas.
// El `layoutId` lleva el tipo delante: los ids empiezan en 1 en cada dataset, así
// que sin eso el "card-1" del anime y el del manga eran el mismo para framer-motion
// y al cambiar de sección una ficha salía volando desde la posición de la otra.
const ContentCard = ({ item, typeId, onSelect, isElastic = false }) => {
  const open = () => onSelect(item);

  // Contador del diario. Cuenta las mismas entradas que pinta el modal — por eso
  // pasa por normalizeEntries y no por item.entries.length: una fila a medias no
  // debe subir el número y luego no aparecer al abrir la ficha.
  const notes = normalizeEntries(item.entries).length;

  // La web se llama Carlos' Opinion y su portada no enseñaba ni una opinión: la
  // nota vivía sólo dentro del modal.
  const rating = itemRating(item);

  return (
    <motion.div
      layout={isElastic ? true : 'position'}
      layoutId={`card-${typeId}-${item.id}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.05, y: -5 }}
      transition={{ duration: 0.3 }}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${item.title}`}
      className="relative cursor-pointer group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0f172a]"
    >
      <div className="bg-white/10 dark:bg-gray-800/60 backdrop-blur-md rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300">
        {/* Image Container */}
        <div className="relative overflow-hidden w-full">
          <CoverImage
            src={item.image}
            alt={item.title}
            className="w-full h-auto block group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {rating !== null && (
            <span
              className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 text-sm font-bold rounded-full bg-black/70 text-yellow-300 border border-yellow-400/40 backdrop-blur-sm"
              aria-label={`Nota: ${showRating(rating)} sobre 10`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.31 4.04a1 1 0 00.95.69h4.25c.97 0 1.37 1.24.59 1.81l-3.44 2.5a1 1 0 00-.36 1.12l1.31 4.04c.3.92-.75 1.69-1.54 1.12l-3.43-2.5a1 1 0 00-1.18 0l-3.43 2.5c-.79.57-1.84-.2-1.54-1.12l1.31-4.04a1 1 0 00-.36-1.12l-3.44-2.5c-.78-.57-.38-1.81.59-1.81h4.25a1 1 0 00.95-.69l1.31-4.04z" />
              </svg>
              {showRating(rating)}
            </span>
          )}

          {notes > 0 && (
            <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-black/60 text-purple-100 border border-purple-400/40 backdrop-blur-sm">
              {esquemaDe(typeId).countLabel(notes)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{item.title}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{item.description}</p>

          {/* Genre Tags */}
          <div className="flex flex-wrap gap-2">
            {item.genres.map((genre) => (
              <span
                key={genre}
                className="px-2 py-1 text-xs rounded-full bg-gradient-to-r from-purple-500/30 to-blue-500/30 border border-purple-400/30 text-purple-600 dark:text-purple-200"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ContentCard;
