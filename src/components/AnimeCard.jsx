import { motion } from 'framer-motion';

const AnimeCard = ({ anime, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      transition={{ duration: 0.3 }}
      onClick={() => onClick(anime)}
      className="relative cursor-pointer group"
    >
      <div className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300">
        {/* Image Container */}
        <div className="relative overflow-hidden h-64">
          <img 
            src={anime.image} 
            alt={anime.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        
        {/* Content */}
        <div className="p-4">
          <h3 className="text-xl font-bold text-black mb-2 truncate">
            {anime.title}
          </h3>
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {anime.description}
          </p>
          
          {/* Genre Tags */}
          <div className="flex flex-wrap gap-2">
            {anime.genres.map((genre, index) => (
              <span 
                key={index}
                className="px-2 py-1 text-xs rounded-full bg-gradient-to-r from-purple-500/30 to-blue-500/30 border border-purple-400/30 text-purple-600"
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

export default AnimeCard;
