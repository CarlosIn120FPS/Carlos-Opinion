import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CoverImage from './CoverImage';
import EntriesBlock from './EntriesBlock';
import { ESQUEMA } from '../data/niveles';
import { normalizeEntries } from '../lib/entries';
import { hermanas } from '../lib/related';
import { useModalChrome } from '../hooks/useModalChrome';
import { ratingEntries, opinionEntries } from '../lib/opinionFields';

const COMIC_FONT = { fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" };

const RATING_LABELS = {
  during: 'Rating (mientras leo):',
  final: 'Rating final:',
  single: 'Rating:',
};

const OPINION_LABELS = {
  during: 'Mientras leo',
  final: 'Final',
  single: 'Opinión',
};

const MangaModal = ({ item, onClose, onOpenRelated }) => {
  const [selectedStore, setSelectedStore] = useState(null);

  // Escape cierra primero la tienda si está abierta; sólo si no, el modal entero.
  const handleEscape = useCallback(() => {
    if (selectedStore) setSelectedStore(null);
    else onClose();
  }, [selectedStore, onClose]);

  useModalChrome(handleEscape);

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Modal Content - Manga Panels Layout */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-4 border-black dark:border-gray-700 shadow-2xl p-4 md:p-6"
        style={COMIC_FONT}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 border-2 border-black transition-all duration-200"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            <CoverImage
              src={item.image}
              alt={item.title}
              className="w-full max-h-[400px] object-cover border-2 border-black dark:border-gray-600 filter grayscale-[20%] contrast-125"
              wrapperClassName="w-full border-2 border-black dark:border-gray-600"
            />
            <h2 className="text-3xl font-black mt-4 text-center uppercase tracking-tighter" style={{ WebkitTextStroke: '1px black' }}>
              {item.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 font-bold italic">{item.japaneseTitle}</p>
          </div>

          {/* Right Column for other panels */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Panel 2: Info & Genres */}
            <div className="border-4 border-black dark:border-gray-700 p-4 bg-yellow-50 dark:bg-yellow-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] relative">
              <div className="flex flex-wrap gap-2 mb-3 relative z-10">
                {item.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 text-sm border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-800 font-bold transform -rotate-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]"
                  >
                    {genre}
                  </span>
                ))}
              </div>
              <div className="space-y-2 font-semibold">
                <p>
                  <span className="font-black text-blue-600 dark:text-blue-400">Autor:</span> {item.author}
                </p>
                <p>
                  <span className="font-black text-blue-600 dark:text-blue-400">Capítulos/Volúmenes:</span>{' '}
                  {item.chapters} / {item.volumes}
                </p>
                {hermanas(item, 'manga').map((h) => (
                  <p key={h.seccion}>
                    <span className="font-black text-blue-600 dark:text-blue-400">{h.pregunta}</span>{' '}
                    {h.estado === 'ficha' ? (
                      <button
                        type="button"
                        onClick={() => onOpenRelated?.(h.seccion, h.id)}
                        className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] font-bold text-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                      >
                        {h.etiqueta}
                      </button>
                    ) : h.etiqueta}
                  </p>
                ))}
              </div>
            </div>

            {/* Panel 3: Synopsis */}
            <div className="border-4 border-black dark:border-gray-700 p-5 bg-blue-50 dark:bg-blue-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] flex-1">
              <h3 className="text-xl font-black mb-2 uppercase border-b-2 border-black dark:border-gray-500 inline-block">
                Sinopsis
              </h3>
              <p className="leading-relaxed font-medium">{item.fullSynopsis}</p>
            </div>
          </div>

          {/* Panel 4: Platforms, Stores & Languages */}
          <div className="md:col-span-12 border-4 border-black dark:border-gray-700 p-4 bg-purple-50 dark:bg-purple-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <h3 className="font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block mb-2">
                Dónde Leerlo Online
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.platforms.map((platform) => (
                  <span
                    key={platform}
                    className="px-2 py-1 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] font-bold text-sm"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            {item.physicalStores.length > 0 && (
              <div className="flex-1">
                <h3 className="font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block mb-2 text-green-700 dark:text-green-400">
                  Dónde Comprar
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.physicalStores.map((store) => (
                    <button
                      key={store.name}
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
              <h3 className="font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block mb-2">
                Idiomas
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.languages.map((language) => (
                  <span
                    key={language}
                    className="px-2 py-1 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] font-bold text-sm"
                  >
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
                {ratings.map((entry) => (
                  <div key={entry.key} className="mb-2">
                    <span className="font-black">{entry.label}</span>{' '}
                    <span className="text-xl font-black text-red-600 dark:text-red-400">{entry.value}</span>
                  </div>
                ))}
                {item.doIRecommend && (
                  <div className="mt-4">
                    <span className="font-black block mb-1">¿Lo recomiendo?</span>
                    <p className="border-2 border-dashed border-gray-400 dark:border-gray-600 p-2 font-medium bg-gray-50 dark:bg-gray-900/50">
                      {item.doIRecommend}
                    </p>
                  </div>
                )}
              </div>

              {/* Speech bubbles. Antes cada rama pintaba su propio bocadillo y la
                  rama de "una sola opinión" se había quedado sin variantes dark:,
                  o sea texto casi blanco sobre blanco. Ahora hay un único bocadillo. */}
              <div className="flex flex-col gap-3 relative">
                {opinions.map((entry) => (
                  <div
                    key={entry.key}
                    className="relative p-4 border-2 border-black dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 shadow-md"
                  >
                    <div className="absolute -left-2 top-4 w-4 h-4 bg-white dark:bg-gray-700 border-l-2 border-b-2 border-black dark:border-gray-600 transform rotate-45" />
                    <p className="font-black text-xs text-gray-500 dark:text-gray-300 uppercase mb-1">{entry.label}</p>
                    <p className="font-semibold italic">&quot;{entry.value}&quot;</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel 6: el diario, volumen a volumen. Otra viñeta más, plegada.
              Cuenta con normalizeEntries y no con .length: una fila a medias
              haría aparecer una viñeta amarilla completamente vacía, porque el
              bloque de dentro sí la descarta. */}
          {normalizeEntries(item.entries).length > 0 && (
            <div className="md:col-span-12 border-4 border-black dark:border-gray-700 bg-green-50 dark:bg-green-900/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] p-5">
              <EntriesBlock
                entries={item.entries}
                schema={ESQUEMA.manga}
                variant="vinieta"
                className=""
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Store Nested Modal */}
      <AnimatePresence>
        {selectedStore && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Dónde comprar: ${selectedStore.name}`}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStore(null)} />
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]"
              style={COMIC_FONT}
            >
              <button
                onClick={() => setSelectedStore(null)}
                aria-label="Cerrar tienda"
                className="absolute -top-4 -right-4 w-8 h-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 border-2 border-black text-white transition-all z-10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-2xl font-black mb-4 uppercase text-center border-b-4 border-black dark:border-gray-600 pb-2 text-gray-900 dark:text-gray-100">
                {selectedStore.name}
              </h3>

              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                {selectedStore.languages?.length > 0 ? (
                  selectedStore.languages.map((langData) => (
                    <div
                      key={langData.language}
                      className="border-4 border-black dark:border-gray-600 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]"
                    >
                      <h4 className="text-xl font-black mb-3 border-b-2 border-black dark:border-gray-600 pb-1 text-gray-900 dark:text-gray-100 uppercase">
                        {langData.language}
                      </h4>
                      <div className="space-y-2">
                        {(langData.volumes ?? []).map((vol) => (
                          <a
                            key={vol.url}
                            href={vol.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 border-2 border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-all font-bold text-gray-900 dark:text-gray-100 flex justify-between items-center"
                          >
                            <span>{vol.name}</span>
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center font-bold text-gray-500 dark:text-gray-400 py-4">
                    No hay volúmenes disponibles por ahora.
                  </p>
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
