import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CoverImage from './CoverImage';
import EntriesBlock from './EntriesBlock';
import { ESQUEMA } from '../data/niveles';
import { hermanas } from '../lib/related';
import { useModalChrome } from '../hooks/useModalChrome';
import { ratingEntries, opinionEntries } from '../lib/opinionFields';

// La textura de papel se sirve desde aquí, no desde transparenttextures.com:
// era la última petición a un tercero que quedaba en la web (las portadas ya
// se trajeron a public/covers/), y si ese CDN cae el libro se queda sin papel.
const PAPER_TEXTURE = `url('${import.meta.env.BASE_URL}texturas/papel-crema.png')`;
const COLUMN_GAP_PX = 64; // 4rem

const RATING_LABELS = {
  during: 'Rating (mientras leo):',
  final: 'Rating final:',
  single: 'Rating:',
};

const OPINION_LABELS = {
  during: 'Pensamientos en curso:',
  final: 'Veredicto Final:',
  single: 'Reseña:',
};

const LightNovelModal = ({ item, onClose, onOpenRelated }) => {
  const [currentSpread, setCurrentSpread] = useState(0);
  const [totalSpreads, setTotalSpreads] = useState(1);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [selectedStore, setSelectedStore] = useState(null);
  const contentRef = useRef(null);

  const handleEscape = useCallback(() => {
    if (selectedStore) setSelectedStore(null);
    else onClose();
  }, [selectedStore, onClose]);

  useModalChrome(handleEscape);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const calculateSpreads = () => {
      if (!contentRef.current) return;
      const scrollW = contentRef.current.scrollWidth;
      const clientW = contentRef.current.clientWidth;
      const spreads = Math.max(1, Math.ceil((scrollW + COLUMN_GAP_PX) / (clientW + COLUMN_GAP_PX)));
      setTotalSpreads(spreads);
      // Al ensanchar la ventana el libro necesita menos páginas. Sin este tope te
      // quedabas en una página que ya no existe: hoja en blanco y "Pág 3 de 1".
      setCurrentSpread((spread) => Math.min(spread, spreads - 1));
    };

    calculateSpreads();
    window.addEventListener('resize', calculateSpreads);
    // Un pequeño delay para que las fuentes/imágenes carguen y recalcule
    const timer = setTimeout(calculateSpreads, 200);

    return () => {
      window.removeEventListener('resize', calculateSpreads);
      clearTimeout(timer);
    };
  }, [item, isMobile]);

  const nextSpread = () => setCurrentSpread((s) => Math.min(s + 1, totalSpreads - 1));
  const prevSpread = () => setCurrentSpread((s) => Math.max(s - 1, 0));

  const ratings = ratingEntries(item, RATING_LABELS);
  const opinions = opinionEntries(item, OPINION_LABELS);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      // `perspective-1000` y `transform-style-3d` son utilidades de Tailwind v4;
      // este proyecto va con la v3, así que no generaban ni una línea de CSS y el
      // "libro" se abría en plano. En estilo inline sí funciona.
      style={{ perspective: '1000px' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm" />

      {/* Book Container */}
      <motion.div
        initial={{ rotateY: -90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: 90, opacity: 0 }}
        transition={{ duration: 0.6, type: 'spring', damping: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full h-[85vh] bg-[#f4ecd8] dark:bg-[#2d2822] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ backgroundImage: PAPER_TEXTURE, transformStyle: 'preserve-3d' }}
      >
        {/* Book Spine Shadow Overlay */}
        <div className="hidden md:block absolute inset-y-0 left-1/2 w-12 -ml-6 bg-gradient-to-r from-transparent via-[rgba(0,0,0,0.15)] to-transparent pointer-events-none z-20" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-2 right-2 md:top-4 md:right-4 z-30 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-stone-800/20 hover:bg-stone-800/40 transition-colors"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6 text-stone-800 dark:text-stone-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Static Overlay for Navigation & Margins */}
        <div className="absolute inset-0 p-6 md:p-10 pb-16 pointer-events-none z-10" style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.05)' }}>
          <div className="h-full w-full relative">
            {currentSpread > 0 && (
              <button
                onClick={prevSpread}
                className="absolute -bottom-10 left-0 flex items-center gap-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-colors pointer-events-auto"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-serif font-bold text-sm">Anterior</span>
              </button>
            )}
            {currentSpread < totalSpreads - 1 && (
              <button
                onClick={nextSpread}
                className="absolute -bottom-10 right-0 flex items-center gap-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-colors pointer-events-auto"
              >
                <span className="font-serif font-bold text-sm">Siguiente</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-stone-400 dark:text-stone-500 font-serif text-xs">
              Pág {currentSpread + 1} de {totalSpreads}
            </div>
          </div>
        </div>

        {/* CSS Multi-Column Content Wrapper */}
        <div className="w-full h-full p-6 md:p-10 pb-16 overflow-hidden">
          <div
            ref={contentRef}
            className="h-full font-serif text-stone-800 dark:text-stone-200 transition-transform duration-500 ease-in-out"
            style={{
              columnCount: isMobile ? 1 : 2,
              columnGap: '4rem',
              columnFill: 'auto',
              transform: `translateX(calc(-${currentSpread * 100}% - ${currentSpread * 4}rem))`,
            }}
          >
            {/* --- PORTADA Y TÍTULO --- */}
            <div className="break-inside-avoid mb-8 text-center">
              <h2
                className="text-3xl md:text-4xl font-serif text-stone-800 dark:text-stone-200 mb-2 border-b border-stone-400 dark:border-stone-600 pb-4"
                style={{ textShadow: '1px 1px 0 rgba(255,255,255,0.2)' }}
              >
                {item.title}
              </h2>
              {item.spanishTitle && (
                <p className="text-stone-700 dark:text-stone-300 font-serif mt-2">{item.spanishTitle}</p>
              )}
              <p className="text-stone-500 dark:text-stone-400 font-serif italic mt-2">{item.japaneseTitle}</p>
              <div className="flex justify-center mt-6">
                <div className="relative p-2 bg-white dark:bg-[#1a1714] shadow-lg rotate-1">
                  <CoverImage
                    src={item.image}
                    alt={item.title}
                    className="w-40 md:w-64 h-auto border border-stone-200 dark:border-stone-700"
                    wrapperClassName="w-40 md:w-64 border border-stone-200 dark:border-stone-700"
                  />
                </div>
              </div>
            </div>

            {/* --- INFO TÉCNICA --- */}
            {/* En móvil este bloque NO se protege de partirse: como no cabía
                entero debajo de la portada, saltaba de página y la primera
                quedaba medio vacía (portada arriba, nada abajo, "Pág 1 de 4").
                En escritorio, con dos columnas, sí se mantiene junto. */}
            <div className="md:break-inside-avoid mb-8 space-y-4">
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {item.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 bg-stone-800 dark:bg-stone-600 text-stone-100 text-xs rounded-full uppercase tracking-wider"
                  >
                    {genre}
                  </span>
                ))}
              </div>
              <p>
                <strong className="text-stone-900 dark:text-stone-100">Autor:</strong> {item.author}
              </p>
              {item.illustrator && (
                <p>
                  <strong className="text-stone-900 dark:text-stone-100">Ilustrador:</strong> {item.illustrator}
                </p>
              )}
              <p>
                <strong className="text-stone-900 dark:text-stone-100">Volúmenes:</strong> {item.volumes}
              </p>
              {hermanas(item, 'lightnovel').map((h) => (
                <p key={h.seccion}>
                  <strong className="text-stone-900 dark:text-stone-100">{h.pregunta}:</strong>{' '}
                  {h.estado === 'ficha' ? (
                    <button
                      type="button"
                      onClick={() => onOpenRelated?.(h.seccion, h.id)}
                      className="px-2 py-0.5 text-sm font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 rounded border border-amber-400 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
                    >
                      {h.etiqueta}
                    </button>
                  ) : h.etiqueta}
                </p>
              ))}
              <p>
                <strong className="text-stone-900 dark:text-stone-100">Idiomas:</strong> {item.languages.join(', ')}
              </p>

              {item.platforms.length > 0 && (
                <p className="flex items-center flex-wrap gap-2 pt-1">
                  <strong className="text-stone-900 dark:text-stone-100">Dónde Leerlo Online:</strong>
                  {item.platforms.map((platform) => (
                    <span
                      key={platform}
                      className="px-2 py-0.5 text-xs bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded border border-stone-300 dark:border-stone-600 shadow-sm"
                    >
                      {platform}
                    </span>
                  ))}
                </p>
              )}

              {item.physicalStores.length > 0 && (
                <p className="flex items-center flex-wrap gap-2 pt-1">
                  <strong className="text-stone-900 dark:text-stone-100">Dónde Comprar:</strong>
                  {item.physicalStores.map((store) => (
                    <button
                      key={store.name}
                      onClick={() => setSelectedStore(store)}
                      className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 rounded border border-amber-400 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800/60 shadow-sm hover:shadow transition-all"
                    >
                      {store.name}
                    </button>
                  ))}
                </p>
              )}
            </div>

            {/* --- SINOPSIS (Texto que puede fluir) --- */}
            <div className="mb-8 text-justify break-before-column">
              <h3 className="text-2xl font-bold mb-4 border-b-2 border-stone-800 dark:border-stone-500 inline-block">
                Sinopsis
              </h3>
              <p className="leading-relaxed first-letter:text-5xl first-letter:font-bold first-letter:mr-1 first-letter:float-left first-letter:text-stone-900 dark:first-letter:text-stone-100">
                {item.fullSynopsis}
              </p>
            </div>

            {/* --- CALIFICACIÓN --- */}
            <div className="break-inside-avoid mb-8">
              <h3 className="text-2xl font-bold mb-4 border-b-2 border-stone-800 dark:border-stone-500 inline-block">
                Calificación
              </h3>
              <div className="bg-stone-200/50 dark:bg-[#1a1714]/60 p-4 rounded-lg border border-stone-300 dark:border-stone-700">
                {ratings.map((entry) => (
                  <p key={entry.key} className="mb-2 last:mb-0">
                    <strong className="text-stone-900 dark:text-stone-100">{entry.label}</strong>{' '}
                    <span className="text-lg text-amber-700 dark:text-amber-500 font-bold">{entry.value}</span>
                  </p>
                ))}

                {item.doIRecommend && (
                  <div className="mt-4 pt-4 border-t border-stone-300 dark:border-stone-700">
                    <strong className="block text-stone-900 dark:text-stone-100 mb-1">¿Lo recomiendo?</strong>
                    <p className="italic text-stone-600 dark:text-stone-400">{item.doIRecommend}</p>
                  </div>
                )}
              </div>
            </div>

            {/* --- LA RESEÑA (Texto que puede fluir) --- */}
            {/* Se llamaba "El Diario de Carlos", pero lo que hay dentro es su
                opinión de la obra entera — sus propias etiquetas ya dicen
                "Reseña" y "Veredicto Final". El diario de verdad, volumen a
                volumen, es el bloque de abajo; dos cosas no pueden llamarse igual. */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4 border-b-2 border-stone-800 dark:border-stone-500 inline-block">
                La Reseña
              </h3>
              <div className="space-y-4">
                {opinions.map((entry) => (
                  <div key={entry.key} className="break-inside-avoid">
                    <strong className="text-stone-900 dark:text-stone-100 block mb-1">{entry.label}</strong>
                    <p className="italic text-stone-600 dark:text-stone-400 pl-4 border-l-4 border-stone-400 dark:border-stone-600">
                      &quot;{entry.value}&quot;
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* El diario por volúmenes. Sin plegar: este modal pagina con
                columnas CSS y sólo recalcula al redimensionar, así que un
                plegable dejaría el contador de páginas mintiendo. En un libro,
                que el diario ocupe sus páginas es justo lo que se quiere. */}
            <EntriesBlock
              entries={item.entries}
              schema={ESQUEMA.lightnovel}
              variant="libro"
              collapsible={false}
              className="mb-8"
            />
          </div>
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedStore(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-[#f4ecd8] dark:bg-[#2d2822] rounded-lg shadow-2xl p-6 border-2 border-stone-300 dark:border-stone-700 font-serif"
              style={{ backgroundImage: PAPER_TEXTURE }}
            >
              <button
                onClick={() => setSelectedStore(null)}
                aria-label="Cerrar tienda"
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-stone-300 dark:bg-stone-700 hover:bg-stone-400 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-2xl font-bold mb-4 text-center border-b-2 border-stone-400 dark:border-stone-600 pb-2 text-stone-900 dark:text-stone-100">
                {selectedStore.name}
              </h3>

              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                {selectedStore.languages?.length > 0 ? (
                  selectedStore.languages.map((langData) => (
                    <div
                      key={langData.language}
                      className="border border-stone-300 dark:border-stone-700 rounded p-4 bg-stone-100/50 dark:bg-[#1a1714]/50"
                    >
                      <h4 className="text-xl font-bold mb-3 border-b border-stone-300 dark:border-stone-600 pb-1 text-stone-900 dark:text-stone-100 font-serif">
                        {langData.language}
                      </h4>
                      <div className="space-y-2">
                        {(langData.volumes ?? []).map((vol) => (
                          <a
                            key={vol.url}
                            href={vol.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 border border-stone-300 dark:border-stone-700 bg-white/50 dark:bg-[#1a1714]/50 hover:bg-white dark:hover:bg-[#1a1714] rounded transition-all font-bold text-stone-800 dark:text-stone-200 flex justify-between items-center group shadow-sm hover:shadow"
                          >
                            <span>{vol.name}</span>
                            <svg
                              className="w-5 h-5 text-amber-600 dark:text-amber-500 opacity-50 group-hover:opacity-100 transition-opacity"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center italic text-stone-500 dark:text-stone-400 py-4">
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

export default LightNovelModal;
