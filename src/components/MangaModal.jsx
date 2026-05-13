import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MangaModal = ({ manga, onClose }) => {
  const [selectedStore, setSelectedStore] = useState(null);

  if (!manga) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      
      {/* Modal Content - Manga Panels Layout */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-4 border-black dark:border-gray-700 shadow-2xl p-4 md:p-6"
        style={{ fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 border-2 border-black transition-all duration-200"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Comic Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Panel 1: Image & Title */}
          <div className="md:col-span-5 border-4 border-black dark:border-gray-700 p-4 flex flex-col items-center bg-gray-50 dark:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 bg-black dark:bg-gray-700 text-white px-3 py-1 font-bold text-sm z-10 border-r-2 border-b-2 border-black dark:border-gray-600">
              CAP. 1
            </div>
            <img 
              src={manga.image} 
              alt={manga.title}
              className="w-full max-h-[400px] object-cover border-2 border-black dark:border-gray-600 filter grayscale-[20%] contrast-125"
            />
            <h2 className="text-3xl font-black mt-4 text-center uppercase tracking-tighter" style={{ WebkitTextStroke: '1px black' }}>
              {manga.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 font-bold italic">{manga.japaneseTitle}</p>
          </div>

          {/* Right Column for other panels */}
          <div className="md:col-span-7 flex flex-col gap-4">
            
            {/* Panel 2: Info & Genres */}
            <div className="border-4 border-black dark:border-gray-700 p-4 bg-yellow-50 dark:bg-yellow-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] relative">
               <div className="flex flex-wrap gap-2 mb-3 relative z-10">
                {manga.genres.map((genre, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 text-sm border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-800 font-bold transform -rotate-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]"
                  >
                    {genre}
                  </span>
                ))}
              </div>
              <div className="space-y-2 font-semibold">
                <p><span className="font-black text-blue-600 dark:text-blue-400">Autor:</span> {manga.author}</p>
                <p><span className="font-black text-blue-600 dark:text-blue-400">Capítulos/Volúmenes:</span> {manga.chapters} / {manga.volumes}</p>
                <p><span className="font-black text-blue-600 dark:text-blue-400">¿Tiene Anime?:</span> {manga.hasAnime ? '¡Sí!' : 'No'}</p>
              </div>
            </div>

            {/* Panel 3: Synopsis */}
            <div className="border-4 border-black dark:border-gray-700 p-5 bg-blue-50 dark:bg-blue-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] flex-1">
              <h3 className="text-xl font-black mb-2 uppercase border-b-2 border-black dark:border-gray-500 inline-block">Sinopsis</h3>
              <p className="leading-relaxed font-medium">
                {manga.fullSynopsis}
              </p>
            </div>
          </div>

          {/* Panel 4: Platforms, Stores & Languages */}
          <div className="md:col-span-12 border-4 border-black dark:border-gray-700 p-4 bg-purple-50 dark:bg-purple-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] flex flex-col md:flex-row justify-between gap-6">
             <div className="flex-1">
                <h3 className="font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block mb-2">Dónde Leerlo Online</h3>
                <div className="flex flex-wrap gap-2">
                  {manga.platforms.map((platform, index) => (
                    <span key={index} className="px-2 py-1 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] font-bold text-sm">
                      {platform}
                    </span>
                  ))}
                </div>
             </div>
             
             {manga.physicalStores && manga.physicalStores.length > 0 && (
               <div className="flex-1">
                  <h3 className="font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block mb-2 text-green-700 dark:text-green-400">Dónde Comprar</h3>
                  <div className="flex flex-wrap gap-2">
                    {manga.physicalStores.map((store, index) => (
                      <button 
                        key={index} 
                        onClick={() => setSelectedStore(store)}
                        className="px-2 py-1 bg-green-100 dark:bg-green-900/40 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] font-bold text-sm hover:translate-y-0.5 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                      >
                        {store.name}
                      </button>
                    ))}
                  </div>
               </div>
             )}

             <div className="flex-1">
                <h3 className="font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block mb-2">Idiomas</h3>
                <div className="flex flex-wrap gap-2">
                  {manga.languages.map((language, index) => (
                    <span key={index} className="px-2 py-1 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] font-bold text-sm">
                      {language}
                    </span>
                  ))}
                </div>
             </div>
          </div>

          {/* Panel 5: Opinions & Ratings */}
          <div className="md:col-span-12 border-4 border-black dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] p-5 relative">
            <div className="absolute -top-4 left-10 bg-black dark:bg-gray-700 text-white px-4 py-1 font-black transform -skew-x-12">
              LA OPINIÓN DE CARLOS
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 {manga.rating && manga.ratingAfterWatching ? (
                    <>
                      <div className="mb-2">
                        <span className="font-black">Rating (mientras leo):</span> <span className="text-xl font-black text-red-600">{manga.rating}</span>
                      </div>
                      <div className="mb-2">
                        <span className="font-black">Rating final:</span> <span className="text-xl font-black text-red-600">{manga.ratingAfterWatching}</span>
                      </div>
                    </>
                  ) : manga.ratingAfterWatching ? (
                    <div className="mb-2">
                      <span className="font-black">Rating:</span> <span className="text-xl font-black text-red-600">{manga.ratingAfterWatching}</span>
                    </div>
                  ) : manga.rating && (
                    <div className="mb-2">
                      <span className="font-black">Rating (mientras leo):</span> <span className="text-xl font-black text-red-600">{manga.rating}</span>
                    </div>
                  )}
                  <div className="mt-4">
                    <span className="font-black block mb-1">¿Lo recomiendo?</span>
                    <p className="border-2 border-dashed border-gray-400 dark:border-gray-600 p-2 font-medium bg-gray-50 dark:bg-gray-900/50">{manga.doIRecommend}</p>
                  </div>
              </div>

              <div className="flex flex-col gap-3 relative">
                {/* Speech bubble for opinion */}
                {manga.personalOpinion && manga.personalOpinionAfterWatching ? (
                  <>
                    <div className="relative p-4 border-2 border-black dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 shadow-md">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-white dark:bg-gray-700 border-l-2 border-b-2 border-black dark:border-gray-600 transform rotate-45"></div>
                      <p className="font-black text-xs text-gray-500 uppercase mb-1">Mientras leo</p>
                      <p className="font-semibold italic">"{manga.personalOpinion}"</p>
                    </div>
                    <div className="relative p-4 border-2 border-black dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 shadow-md">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-white dark:bg-gray-700 border-l-2 border-b-2 border-black dark:border-gray-600 transform rotate-45"></div>
                      <p className="font-black text-xs text-gray-500 uppercase mb-1">Final</p>
                      <p className="font-semibold italic">"{manga.personalOpinionAfterWatching}"</p>
                    </div>
                  </>
                ) : manga.personalOpinionAfterWatching ? (
                   <div className="relative p-4 border-2 border-black rounded-2xl bg-white shadow-md">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-white border-l-2 border-b-2 border-black transform rotate-45"></div>
                      <p className="font-black text-xs text-gray-500 uppercase mb-1">Opinión</p>
                      <p className="font-semibold italic">"{manga.personalOpinionAfterWatching}"</p>
                    </div>
                ) : manga.personalOpinion && (
                   <div className="relative p-4 border-2 border-black rounded-2xl bg-white shadow-md">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-white border-l-2 border-b-2 border-black transform rotate-45"></div>
                      <p className="font-black text-xs text-gray-500 uppercase mb-1">Mientras leo</p>
                      <p className="font-semibold italic">"{manga.personalOpinion}"</p>
                    </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Store Nested Modal */}
      <AnimatePresence>
        {selectedStore && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStore(null)} />
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]"
              style={{ fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" }}
            >
              <button
                onClick={() => setSelectedStore(null)}
                className="absolute -top-4 -right-4 w-8 h-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 border-2 border-black text-white transition-all z-10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <h3 className="text-2xl font-black mb-4 uppercase text-center border-b-4 border-black dark:border-gray-600 pb-2 text-gray-900 dark:text-gray-100">
                {selectedStore.name}
              </h3>
              
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                {selectedStore.languages && selectedStore.languages.length > 0 ? (
                  selectedStore.languages.map((langData, idx) => (
                    <div key={idx} className="border-4 border-black dark:border-gray-600 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                      <h4 className="text-xl font-black mb-3 border-b-2 border-black dark:border-gray-600 pb-1 text-gray-900 dark:text-gray-100 uppercase">
                        {langData.language}
                      </h4>
                      <div className="space-y-2">
                        {langData.volumes.map((vol, vIdx) => (
                          <a
                            key={vIdx}
                            href={vol.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 border-2 border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-all font-bold text-gray-900 dark:text-gray-100 flex justify-between items-center"
                          >
                            <span>{vol.name}</span>
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center font-bold text-gray-500 py-4">No hay volúmenes disponibles por ahora.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MangaModal;
