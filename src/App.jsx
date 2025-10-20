import { useState } from 'react';
import { motion } from 'framer-motion';
import AnimeCard from './components/AnimeCard';
import AnimeModal from './components/AnimeModal';
import { animeData, categories } from './animeData';

function App() {
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAnime = animeData.filter(anime => {
    const matchesCategory = activeCategory === 'Todos' || anime.category === activeCategory;
    const matchesSearch = anime.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen p-8">
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
        <p className="text-xl text-blue-00/80">
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
              className="w-full px-6 py-3 pl-12 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-purple-300 placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
            />
            <svg 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/70" 
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={() => setActiveCategory('Todos')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            activeCategory === 'Todos'
              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/50'
              : 'bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 hover:bg-white/20'
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
                : 'bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 hover:bg-white/20'
            }`}
          >
            {category}
          </button>
        ))}
        </div>
      </motion.div>

      {/* Anime Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-7xl mx-auto"
      >
        {categories.map((category) => {
          const categoryAnime = filteredAnime.filter(anime => anime.category === category);
          
          if (activeCategory !== 'Todos' && activeCategory !== category) return null;
          if (categoryAnime.length === 0) return null;
          
          return (
            <div key={category} className="mb-12">
              <h2 className="text-3xl font-bold text-purple-300 mb-6 flex items-center gap-3">
                <span className="w-2 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                {category}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryAnime.map((anime) => (
                  <AnimeCard 
                    key={anime.id} 
                    anime={anime} 
                    onClick={setSelectedAnime}
                  />
                ))}
              </div>
            </div>
          );
        })}
        
        {filteredAnime.length === 0 && (
          <div className="text-center py-20">
            <p className="text-2xl text-purple-300/70">
              No se encontraron animes con "{searchTerm}"
            </p>
          </div>
        )}
      </motion.div>

      {/* Modal */}
      {selectedAnime && (
        <AnimeModal 
          anime={selectedAnime} 
          onClose={() => setSelectedAnime(null)} 
        />
      )}
    </div>
  );
}

export default App;

