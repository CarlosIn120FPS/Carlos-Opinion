import { motion, AnimatePresence } from 'framer-motion';

const AnimeModal = ({ anime, onClose }) => {
  if (!anime) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        onClick={onClose}
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
          className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/30 transition-all duration-200"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Image */}
              <div className="flex-shrink-0">
                <img 
                  src={anime.image} 
                  alt={anime.title}
                  className="w-64 h-auto rounded-xl shadow-lg"
                />
              </div>

              {/* Basic Info */}
              <div className="flex-1">
                <h2 className="text-4xl font-bold text-white mb-3 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {anime.title}
                </h2>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {anime.genres.map((genre, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 text-sm rounded-full bg-gradient-to-r from-purple-500/40 to-blue-500/40 border border-purple-400/50 text-purple-100"
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                <div className="space-y-3 text-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Título en Japonés:</span>
                    <span>{anime.japaneseTitle}</span>
                  </div>
                
                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Episodios:</span>
                    <span>{anime.episodes}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Tiene manga?</span>
                    <span>{anime.hasManga ? 'Sí' : 'No'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Tiene novela ligera?</span>
                    <span>{anime.hasLightNovel ? 'Sí' : 'No'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Voy a leer alguno de ellos?</span>
                    <span>{anime.amigonnareadanyofthem}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Lo recomiendo?</span>
                    <span>{anime.doIRecommend}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 font-semibold">Valoración:</span>
                    <span className="text-yellow-400">{anime.rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent mb-6" />

            {/* Openings */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">Openings</h3>
              <div className="flex flex-wrap gap-3">
                {anime.openings && anime.openings.length > 0 ? (
                  anime.openings.map((opening, index) => (
                    <a
                      key={index}
                      href={opening.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/40 to-blue-500/40 border border-purple-400/50 text-purple-100 hover:scale-105 hover:bg-purple-500/60 transition-transform duration-200 shadow-md"
                    >
                      {opening.name}
                    </a>
                  ))
                ) : (
                  <p className="text-gray-400 italic">No hay openings disponibles.</p>
                )}
              </div>
            </div>

           {/* Endings */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">Endings</h3>
              <div className="flex flex-wrap gap-3">
                {anime.endings && anime.endings.length > 0 ? (
                  anime.endings.map((ending, index) => (
                    <a
                      key={index}
                      href={ending.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/40 to-blue-500/40 border border-purple-400/50 text-purple-100 hover:scale-105 hover:bg-purple-500/60 transition-transform duration-200 shadow-md"
                    >
                      {ending.name}
                    </a>
                  ))
                ) : (
                  <p className="text-gray-400 italic">No hay openings disponibles.</p>
                )}
              </div>
            </div>

            {/* Synopsis */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">Sinopsis</h3>
              <p className="text-gray-300 leading-relaxed">
                {anime.fullSynopsis}
              </p>
            </div>

            {/* Platforms */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">Plataformas</h3>
              <div className="flex flex-wrap gap-3">
                {anime.platforms.map((platform, index) => (
                  <span 
                    key={index}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-purple-400/30 text-white"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">Idiomas Disponibles</h3>
              <div className="flex flex-wrap gap-3">
                {anime.languages.map((language, index) => (
                  <span 
                    key={index}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-blue-400/30 text-white"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>

            {/* Personal Opinion */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-purple-400/30">
              <h3 className="text-2xl font-bold text-purple-300 mb-3">Opinión Personal</h3>
              <p className="text-gray-300 leading-relaxed italic">
                "{anime.personalOpinion}"
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimeModal;
