import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimeCard from './components/AnimeCard';
import AnimeModal from './components/AnimeModal';
import { animeData, categories } from './animeData';

function App() {
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const filteredAnime = animeData.filter(anime => {
    const matchesCategory = activeCategory === 'Todos' || anime.category === activeCategory;
    const matchesSearch = anime.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen p-8 transition-colors duration-300 dark:bg-[#0f172a]">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Carlos' Opinion
        </h1>
        <p className="text-xl text-gray-800 dark:text-gray-300">
          La pagina web en la que Carlos comparte su opinión sobre animes que ha visto, está viendo, verá, o ha abandonado.
        </p>
        
        {/* Decorative line */}
        <div className="mt-6 h-1 w-64 mx-auto bg-gradient-to-r from-transparent via-purple-500 to-transparent rounded-full" />
      </motion.header>

      {/* Category Filter */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-7xl mx-auto mb-12"
      >
        {/* Search Bar */}
        <div className="mb-6 flex justify-center">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Buscar anime por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-3 pl-12 rounded-lg bg-white shadow-sm dark:bg-gray-800/50 backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-800 dark:text-purple-100 placeholder-purple-400 dark:placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
            />
            <svg 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 dark:text-purple-300/70" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-600 dark:text-purple-300/70 dark:hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex justify-center gap-4 flex-wrap items-center relative">
        <button
          onClick={() => setActiveCategory('Todos')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            activeCategory === 'Todos'
              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/50'
              : 'bg-white dark:bg-gray-800/60 shadow-sm dark:shadow-none backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Todos
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeCategory === category
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/50'
                : 'bg-white dark:bg-gray-800/60 shadow-sm dark:shadow-none backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {category}
          </button>
        ))}
          
          {/* Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-3 rounded-full bg-white dark:bg-gray-800/60 shadow-sm dark:shadow-lg backdrop-blur-md border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300"
              aria-label="Ajustes"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="p-2">
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <span className="text-gray-700 dark:text-gray-300">Tema Oscuro</span>
                      <div className={`w-12 h-6 rounded-full transition-colors duration-300 flex items-center p-1 ${isDarkMode ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Anime Grid */}
      <motion.div 
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-7xl mx-auto"
      >
        <AnimatePresence>
          {categories.map((category) => {
            const categoryAnime = filteredAnime.filter(anime => anime.category === category);
            
            if (activeCategory !== 'Todos' && activeCategory !== category) return null;
            if (categoryAnime.length === 0) return null;
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.4 }}
                key={category} 
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-purple-500 dark:text-purple-300 mb-6 flex items-center gap-3">
                  <span className="w-2 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                  {category}
                </h2>
                
                <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence>
                    {categoryAnime.map((anime) => (
                      <AnimeCard 
                        key={anime.id} 
                        anime={anime} 
                        onClick={setSelectedAnime}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        <AnimatePresence>
          {filteredAnime.length === 0 && (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <p className="text-2xl text-purple-600 dark:text-purple-300/70 font-semibold">
                No se encontraron animes con "{searchTerm}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {selectedAnime && (
          <AnimeModal 
            key="modal"
            anime={selectedAnime} 
            onClose={() => setSelectedAnime(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

