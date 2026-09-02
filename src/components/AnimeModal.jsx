import { motion } from 'framer-motion';
import CoverImage from './CoverImage';
import { useModalChrome } from '../hooks/useModalChrome';
import { ratingEntries, opinionEntries } from '../lib/opinionFields';

const RATING_LABELS = {
  during: 'Rating (mientras lo veo):',
  final: 'Rating final:',
  single: 'Rating:',
};

const OPINION_LABELS = {
  during: 'Opinión Personal (mientras lo veo)',
  final: 'Opinión Personal Final',
  single: 'Opinión Personal',
};

const AnimeModal = ({ item, onClose }) => {
  useModalChrome(onClose);

  const ratings = ratingEntries(item, RATING_LABELS);
  const opinions = opinionEntries(item, OPINION_LABELS);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white/10 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700 shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/30 transition-all duration-200"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Image */}
            <div className="flex-shrink-0">
              <CoverImage
                src={item.image}
                alt={item.title}
                className="w-64 h-auto rounded-xl shadow-lg"
                wrapperClassName="w-64 rounded-xl"
              />
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {item.title}
              </h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {item.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 text-sm rounded-full bg-gradient-to-r from-purple-500/40 to-blue-500/40 border border-purple-400/50 text-purple-100"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <div className="space-y-3 text-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">Título en Japonés:</span>
                  <span>{item.japaneseTitle}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">Episodios:</span>
                  <span>{item.episodes}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">Tiene manga?</span>
                  <span>{item.hasManga ? 'Sí' : 'No'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">Tiene novela ligera?</span>
                  <span>{item.hasLightNovel ? 'Sí' : 'No'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">Voy a leer alguno de ellos?</span>
                  <span>{item.willReadSource}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">Lo recomiendo?</span>
                  <span>{item.doIRecommend}</span>
                </div>

                {ratings.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">{entry.label}</span>
                    <span className="text-yellow-400">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent mb-6" />

          {/* Openings & Endings */}
          {[
            { title: 'Openings', tracks: item.openings, empty: 'No hay openings disponibles.' },
            { title: 'Endings', tracks: item.endings, empty: 'No hay endings disponibles.' },
          ].map((section) => (
            <div key={section.title} className="mb-6">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">{section.title}</h3>
              <div className="flex flex-wrap gap-3">
                {section.tracks.length > 0 ? (
                  section.tracks.map((track, index) => (
                    <a
                      key={`${track.url}-${index}`}
                      href={track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/40 to-blue-500/40 border border-purple-400/50 text-purple-100 hover:scale-105 hover:bg-purple-500/60 transition-transform duration-200 shadow-md"
                    >
                      {track.name}
                    </a>
                  ))
                ) : (
                  <p className="text-gray-400 italic">{section.empty}</p>
                )}
              </div>
            </div>
          ))}

          {/* Synopsis */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-purple-300 mb-3">Sinopsis</h3>
            <p className="text-gray-300 leading-relaxed">{item.fullSynopsis}</p>
          </div>

          {/* Platforms */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-purple-300 mb-3">Plataformas</h3>
            <div className="flex flex-wrap gap-3">
              {item.platforms.map((platform) => (
                <span key={platform} className="px-4 py-2 rounded-lg bg-white/10 border border-purple-400/30 text-white">
                  {platform}
                </span>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-purple-300 mb-3">Idiomas Disponibles</h3>
            <div className="flex flex-wrap gap-3">
              {item.languages.map((language) => (
                <span key={language} className="px-4 py-2 rounded-lg bg-white/10 border border-blue-400/30 text-white">
                  {language}
                </span>
              ))}
            </div>
          </div>

          {/* Personal Opinion */}
          <div className="flex flex-col gap-4">
            {opinions.map((entry) => (
              <div
                key={entry.key}
                className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-purple-400/30"
              >
                <h3 className="text-2xl font-bold text-purple-300 mb-3">{entry.label}</h3>
                <p className="text-gray-300 leading-relaxed italic">&quot;{entry.value}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AnimeModal;
