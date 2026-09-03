import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ContentCard from './components/ContentCard';
import PageNavigationModal from './components/PageNavigationModal';

import {
  CONTENT_TYPES,
  CONTENT_TYPE_BY_SLUG,
  CONTENT_TYPE_ORDER,
  DEFAULT_CONTENT_TYPE,
  DEFAULT_SLUG,
} from './data/contentTypes';
import { useContentData } from './data/useContentData';
import { readStored, writeStored, parseBoolean, parseIntInRange } from './lib/storage';
import { matchesSearch } from './lib/search';
import { itemRating, isUnrated } from './lib/rating';

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

// Ordenar la rejilla. "Por defecto" es a.id - b.id, o sea el orden en que Carlos
// creó las fichas: un artefacto interno que no significa nada para quien mira.
const SORTS = {
  defecto: {
    label: 'Como las añadí',
    compare: (a, b) => a.id - b.id,
  },
  nota: {
    label: 'Mejor nota primero',
    // Las fichas sin nota se van al final: si valieran 0 se colarían por delante
    // de un 7 al ordenar al revés, y una ficha sin opinar no es una ficha mala.
    compare: (a, b) => {
      const ra = itemRating(a);
      const rb = itemRating(b);
      if (ra === null && rb === null) return a.id - b.id;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return rb - ra || a.id - b.id;
    },
  },
  titulo: {
    label: 'Alfabético',
    compare: (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
  },
};
const SORT_KEYS = Object.keys(SORTS);

// El número de columnas era un estilo inline, así que ganaba a cualquier clase
// responsive de Tailwind: un móvil se comía las 4 columnas por defecto. Ahora la
// preferencia del usuario se topa con lo que cabe de verdad en la pantalla.
const maxColumnsFor = (width) => {
  if (width < 640) return 1;
  if (width < 768) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  return MAX_COLUMNS;
};

function App() {
  // La sección y la ficha abierta ya no son estado: son la URL. Eso es lo que hace
  // que el botón atrás funcione y que se pueda enlazar a una opinión concreta.
  const { sectionSlug, itemId } = useParams();
  const navigate = useNavigate();

  // Una sección desconocida (/pelis, una URL vieja) redirige al final del
  // componente. Aquí caemos en la de por defecto para que los hooks de abajo se
  // llamen siempre, pasase lo que pasase con la URL.
  const knownType = CONTENT_TYPE_BY_SLUG[sectionSlug];
  const type = knownType ?? CONTENT_TYPES[DEFAULT_CONTENT_TYPE];

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(() =>
    readStored('theme', window.matchMedia('(prefers-color-scheme: dark)').matches, (raw) => raw === 'dark'),
  );

  const [columnCount, setColumnCount] = useState(() =>
    readStored('columnCount', 4, (raw) => parseIntInRange(raw, MIN_COLUMNS, MAX_COLUMNS)),
  );

  const [isElastic, setIsElastic] = useState(() => readStored('isElastic', false, parseBoolean));

  const [sortKey, setSortKey] = useState(() =>
    readStored('sortKey', 'defecto', (raw) => (SORT_KEYS.includes(raw) ? raw : 'defecto')),
  );

  // "Sólo sin opinar": la lista de lo que tiene pendiente escribir.
  const [onlyUnrated, setOnlyUnrated] = useState(false);

  const [maxColumns, setMaxColumns] = useState(() => maxColumnsFor(window.innerWidth));

  const { status, data, error } = useContentData(type);

  useEffect(() => {
    const handleResize = () => setMaxColumns(maxColumnsFor(window.innerWidth));
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => writeStored('columnCount', String(columnCount)), [columnCount]);
  useEffect(() => writeStored('isElastic', String(isElastic)), [isElastic]);
  useEffect(() => writeStored('sortKey', sortKey), [sortKey]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    writeStored('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Reset category and search when switching pages
  useEffect(() => {
    setActiveCategory('Todos');
    setSearchTerm('');
    setOnlyUnrated(false);
  }, [type.id]);

  // El menú de ajustes se quedaba abierto para siempre: no se cerraba ni al
  // pulsar fuera ni con Escape.
  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    const handlePointerDown = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setIsSettingsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsSettingsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const effectiveColumns = Math.min(columnCount, maxColumns);

  const filteredItems = useMemo(() => {
    const compare = (SORTS[sortKey] ?? SORTS.defecto).compare;
    return items
      .filter((item) => {
        if (activeCategory !== 'Todos' && item.category !== activeCategory) return false;
        if (onlyUnrated && !isUnrated(item)) return false;
        return matchesSearch(item, searchTerm);
      })
      .sort(compare);
  }, [items, activeCategory, searchTerm, sortKey, onlyUnrated]);

  const unratedCount = useMemo(() => items.filter(isUnrated).length, [items]);

  const visibleCategories = useMemo(
    () => (activeCategory === 'Todos' ? categories : categories.filter((c) => c === activeCategory)),
    [categories, activeCategory],
  );

  // La ficha abierta se deriva de la URL, no se guarda.
  const selectedItem = useMemo(
    () => (itemId ? (items.find((item) => String(item.id) === itemId) ?? null) : null),
    [items, itemId],
  );

  // El título de la pestaña sigue a la ficha abierta (el HTML por ficha de
  // scripts/og.mjs ya lo trae, pero al navegar dentro de la app hay que
  // mantenerlo). Al cerrar, vuelve al de la sección.
  useEffect(() => {
    document.title = selectedItem ? `${selectedItem.title} · ${type.pageTitle}` : type.pageTitle;
  }, [selectedItem, type.pageTitle]);

  // Enlace a una ficha que ya no existe (id cambiado, enlace viejo): en vez de
  // dejar la página en blanco, volvemos a la sección sin ensuciar el historial.
  useEffect(() => {
    if (status === 'ready' && itemId && !selectedItem) {
      navigate(`/${type.slug}`, { replace: true });
    }
  }, [status, itemId, selectedItem, navigate, type.slug]);

  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const openItem = useCallback((item) => navigate(`/${type.slug}/${item.id}`), [navigate, type.slug]);
  const closeItem = useCallback(() => navigate(`/${type.slug}`), [navigate, type.slug]);
  const goToSection = useCallback(
    (typeId) => navigate(`/${CONTENT_TYPES[typeId].slug}`),
    [navigate],
  );

  // Ir a la ficha hermana en otra sección. Cambia la URL entera (sección + id),
  // así que no hace falta cargar los datos de la otra sección aquí: al navegar,
  // App vuelve a montar contra la nueva ruta y useContentData hace su trabajo.
  const openRelated = useCallback(
    (typeId, id) => navigate(`/${CONTENT_TYPES[typeId].slug}/${id}`),
    [navigate],
  );

  const ItemModal = type.Modal;

  // Todos los hooks ya se han llamado, así que aquí ya es seguro salir.
  if (!knownType) return <Navigate to={`/${DEFAULT_SLUG}`} replace />;

  // El mensaje de "sin resultados" siempre interpolaba el término de búsqueda,
  // así que una categoría vacía anunciaba: No se encontraron resultados con "".
  const renderEmptyState = () => {
    if (searchTerm) {
      return (
        <>
          <p className="text-2xl text-purple-600 dark:text-purple-300/70 font-semibold">
            No se encontraron resultados con &quot;{searchTerm}&quot;
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-4 px-5 py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30"
          >
            Limpiar búsqueda
          </button>
        </>
      );
    }
    if (onlyUnrated) {
      return (
        <p className="text-2xl text-purple-600 dark:text-purple-300/70 font-semibold">
          {activeCategory === 'Todos'
            ? 'No queda nada sin opinar por aquí.'
            : `No queda nada sin opinar en «${activeCategory}».`}
        </p>
      );
    }
    if (activeCategory !== 'Todos') {
      return (
        <p className="text-2xl text-purple-600 dark:text-purple-300/70 font-semibold">
          Todavía no hay nada en «{activeCategory}».
        </p>
      );
    }
    return (
      <p className="text-2xl text-purple-600 dark:text-purple-300/70 font-semibold">
        Esta sección todavía está vacía.
      </p>
    );
  };

  return (
    // En modo claro el fondo era el blanco por defecto, y las tarjetas y botones
    // «cristal» (bg-white/…, backdrop-blur) no se distinguían de él. Un fondo
    // con un degradado tenue es lo que hace que el cristal se lea como cristal.
    // El oscuro no cambia. Y el relleno de 32 px a todos los anchos se comía
    // media pantalla de móvil.
    <div className="min-h-screen p-4 sm:p-6 md:p-8 transition-colors duration-300 bg-gradient-to-b from-indigo-50 via-slate-50 to-purple-50 dark:bg-none dark:bg-[#0f172a]">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8 md:mb-10"
      >
        <button
          onClick={() => setIsNavOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isNavOpen}
          className="hover:scale-105 transition-transform duration-300 relative group mb-2 md:mb-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight pb-2 bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            {type.pageTitle}
          </h1>
        </button>

        {/* Barra de secciones. Antes la única puerta a /manga y /novelas era
            pulsar el título, y la pista era opacity-0 group-hover: en un móvil no
            aparece nunca, así que dos tercios de la web no existían para quien
            llegaba desde un enlace. Ahora se ven las tres siempre. */}
        <nav aria-label="Secciones" className="flex justify-center gap-2 flex-wrap mt-3 md:mt-6">
          {CONTENT_TYPE_ORDER.map((typeId) => {
            const section = CONTENT_TYPES[typeId];
            const isCurrent = section.id === type.id;
            return (
              <button
                key={section.id}
                onClick={() => goToSection(section.id)}
                aria-current={isCurrent ? 'page' : undefined}
                className={`px-4 md:px-5 py-1.5 md:py-2 text-sm md:text-base rounded-full font-semibold transition-all duration-300 ${
                  isCurrent
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/40'
                    : 'bg-white dark:bg-gray-800/60 shadow-sm backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {section.shortLabel}
              </button>
            );
          })}
        </nav>

        {/* En móvil, la frase de presentación y la línea decorativa empujaban
            las portadas fuera de la primera pantalla; quien llega desde un
            enlace compartido viene a ver una ficha, no un subtítulo. */}
        <p className="hidden md:block text-lg text-gray-700 dark:text-gray-300 mt-5 max-w-2xl mx-auto relative z-10">
          {type.pageDescription}
        </p>

        {/* Decorative line */}
        <div className="hidden md:block mt-5 h-1 w-64 mx-auto bg-gradient-to-r from-transparent via-purple-500 to-transparent rounded-full" />
      </motion.header>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-7xl mx-auto mb-8 md:mb-12"
      >
        {/* Search Bar */}
        <div className="mb-4 md:mb-6 flex justify-center">
          <div className="relative w-full max-w-md">
            <input
              type="search"
              aria-label={type.searchPlaceholder}
              placeholder={type.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-2.5 md:py-3 pl-12 rounded-lg bg-white shadow-sm dark:bg-gray-800/50 backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-800 dark:text-purple-100 placeholder-purple-400 dark:placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 dark:text-purple-300/70 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-600 dark:text-purple-300/70 dark:hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex justify-center gap-2 md:gap-4 flex-wrap items-center relative">
          {['Todos', ...categories].map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              aria-pressed={activeCategory === category}
              className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base rounded-lg font-semibold transition-all duration-300 ${
                activeCategory === category
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/50'
                  : 'bg-white dark:bg-gray-800/60 shadow-sm dark:shadow-none backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {category}
            </button>
          ))}

          {/* "Sin opinar": no hay campo nuevo, se deriva de que no haya ni nota,
              ni opinión, ni una sola entrada del diario. Sin esto una ficha a
              medias se ve exactamente igual de terminada que una completa,
              porque los bloques vacíos sencillamente no se pintan. */}
          {unratedCount > 0 && (
            <button
              onClick={() => setOnlyUnrated((value) => !value)}
              aria-pressed={onlyUnrated}
              className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base rounded-lg font-semibold transition-all duration-300 ${
                onlyUnrated
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/40'
                  : 'bg-white dark:bg-gray-800/60 shadow-sm dark:shadow-none backdrop-blur-md border border-dashed border-amber-400/70 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-gray-700'
              }`}
            >
              Sin opinar ({unratedCount})
            </button>
          )}

          {/* Settings Menu */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen((open) => !open)}
              aria-label="Ajustes"
              aria-expanded={isSettingsOpen}
              className="p-3 rounded-full bg-white dark:bg-gray-800/60 shadow-sm dark:shadow-lg backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-3 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200">Ajustes</h3>
                  </div>
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setIsDarkMode((value) => !value)}
                      aria-pressed={isDarkMode}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <span className="text-gray-700 dark:text-gray-300">Tema Oscuro</span>
                      <div className={`w-12 h-6 rounded-full transition-colors duration-300 flex items-center p-1 ${isDarkMode ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </button>
                    {/* Antes esto hacía window.location.reload(). El estado ya es
                        reactivo y la `key` de la tarjeta fuerza el remontaje, así
                        que el recargón solo servía para el parpadeo en blanco. */}
                    <button
                      onClick={() => setIsElastic((value) => !value)}
                      aria-pressed={isElastic}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 mt-1"
                    >
                      <span className="text-gray-700 dark:text-gray-300">Animación Elástica</span>
                      <div className={`w-12 h-6 rounded-full transition-colors duration-300 flex items-center p-1 ${isElastic ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isElastic ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <label htmlFor="sort-key" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Ordenar por
                    </label>
                    <select
                      id="sort-key"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {SORT_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {SORTS[key].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                    <label htmlFor="column-count" className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mb-2">
                      <span>Columnas por fila</span>
                      <span className="font-bold text-purple-500">{effectiveColumns}</span>
                    </label>
                    <input
                      id="column-count"
                      type="range"
                      min={MIN_COLUMNS}
                      max={MAX_COLUMNS}
                      value={columnCount}
                      onChange={(e) => setColumnCount(parseInt(e.target.value, 10))}
                      className="w-full accent-purple-500"
                    />
                    {effectiveColumns < columnCount && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Limitado a {effectiveColumns} por el ancho de la pantalla.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Grid Content */}
      <motion.div
        layout={isElastic ? true : 'position'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="w-full transition-all duration-500"
      >
        {status === 'loading' && (
          <div className="text-center py-20" role="status" aria-live="polite">
            <div className="mx-auto w-10 h-10 rounded-full border-4 border-purple-300 border-t-purple-600 animate-spin" />
            <p className="mt-4 text-purple-600 dark:text-purple-300/70 font-semibold">Cargando…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-20" role="alert">
            <p className="text-2xl text-red-600 dark:text-red-400 font-semibold">
              No se pudieron cargar los datos de esta sección.
            </p>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error?.message}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            <AnimatePresence>
              {visibleCategories.map((category) => {
                const categoryItems = filteredItems.filter((item) => item.category === category);
                if (categoryItems.length === 0) return null;

                return (
                  <motion.div
                    layout={isElastic ? true : 'position'}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{ duration: 0.4 }}
                    key={category}
                    className="mb-12"
                  >
                    <h2 className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-300 mb-4 md:mb-6 flex items-center gap-3">
                      <span className="w-2 h-7 md:h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                      {category}
                    </h2>

                    <div
                      className="grid gap-4 md:gap-6 items-start"
                      style={{ gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: effectiveColumns }).map((_, colIndex) => {
                        const columnItems = categoryItems.filter((_, idx) => idx % effectiveColumns === colIndex);
                        return (
                          <div key={colIndex} className="flex flex-col gap-4 md:gap-6">
                            <AnimatePresence>
                              {columnItems.map((item) => (
                                <ContentCard
                                  key={`${item.id}-${isElastic ? 'elastic' : 'rigid'}`}
                                  item={item}
                                  typeId={type.id}
                                  onSelect={openItem}
                                  isElastic={isElastic}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {filteredItems.length === 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center py-20"
                >
                  {renderEmptyState()}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>

      {/* Navigation Modal */}
      <AnimatePresence>
        {isNavOpen && (
          <PageNavigationModal key="nav-modal" currentPage={type.id} onNavigate={goToSection} onClose={closeNav} />
        )}
      </AnimatePresence>

      {/* Content Modal */}
      <AnimatePresence>
        {selectedItem && (
          <ItemModal
            key={`${type.id}-modal`}
            item={selectedItem}
            onClose={closeItem}
            onOpenRelated={openRelated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
