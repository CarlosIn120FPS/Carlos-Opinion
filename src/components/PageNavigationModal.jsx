import { motion } from 'framer-motion';

const PageNavigationModal = ({ isOpen, onClose, currentPage, onNavigate }) => {
  if (!isOpen) return null;

  const pages = [
    { id: 'anime', title: "Carlos' Anime Opinion", description: "Opiniones y reseñas sobre series y películas de anime." },
    { id: 'manga', title: "Carlos' Manga Opinion", description: "Opiniones y viñetas sobre los mangas que leo." },
    { id: 'lightnovel', title: "Carlos' Light Novel Opinion", description: "Reseñas literarias de novelas ligeras." }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 text-center">Navegar por las Opiniones</h2>
        
        <div className="flex flex-col gap-3">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => {
                onNavigate(page.id);
                onClose();
              }}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                currentPage === page.id 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <h3 className={`text-xl font-bold mb-1 ${currentPage === page.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-800 dark:text-gray-200'}`}>
                {page.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {page.description}
              </p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PageNavigationModal;
