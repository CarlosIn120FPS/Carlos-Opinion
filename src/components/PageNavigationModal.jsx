import { motion } from 'framer-motion';
import { CONTENT_TYPES, CONTENT_TYPE_ORDER } from '../data/contentTypes';
import { useModalChrome } from '../hooks/useModalChrome';

// Antes hacía `if (!isOpen) return null` y App lo renderizaba fuera de
// AnimatePresence, así que se desmontaba de golpe y la animación de salida nunca
// llegaba a ejecutarse. Ahora App decide si existe y la salida sí se ve.
// La lista de secciones tampoco está duplicada aquí: sale del registro.
const PageNavigationModal = ({ currentPage, onNavigate, onClose }) => {
  useModalChrome(onClose);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navegar por las opiniones"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 text-center">
          Navegar por las Opiniones
        </h2>

        <div className="flex flex-col gap-3">
          {CONTENT_TYPE_ORDER.map((id) => {
            const page = CONTENT_TYPES[id];
            const isCurrent = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => {
                  onNavigate(id);
                  onClose();
                }}
                aria-current={isCurrent ? 'page' : undefined}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  isCurrent
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <h3
                  className={`text-xl font-bold mb-1 ${
                    isCurrent ? 'text-purple-600 dark:text-purple-400' : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {page.navTitle}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{page.navDescription}</p>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PageNavigationModal;
