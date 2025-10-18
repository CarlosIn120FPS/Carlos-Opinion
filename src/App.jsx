import { useState } from 'react';
import { motion } from 'framer-motion';
import AnimeCard from './components/AnimeCard';
import AnimeModal from './components/AnimeModal';
import { animeData, categories } from './animeData';

function App() {
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filteredAnime = activeCategory === 'Todos' 
    ? animeData 
    : animeData.filter(anime => anime.category === activeCategory);

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
        className="flex justify-center gap-4 mb-12 flex-wrap"
      >
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
      </motion.div>

      {/* Anime Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-7xl mx-auto"
      >
        {categories.map((category) => {
          const categoryAnime = animeData.filter(anime => anime.category === category);
          
          if (activeCategory !== 'Todos' && activeCategory !== category) return null;
          
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

