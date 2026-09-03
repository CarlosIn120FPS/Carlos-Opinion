import { useState } from 'react';
import { buildDiary, entryRating, formatRating } from '../lib/entries';

// El diario de una ficha: lo que Carlos fue pensando mientras la veía o la leía.
//
// Un solo componente para los tres medios — no sabe si agrupa temporadas o
// volúmenes, eso se lo dice `schema.levels`. Lo único que cambia es la piel, y
// las tres viven aquí juntas a propósito: separadas se desincronizan, que es lo
// que ya pasó con la lógica de ratings antes de opinionFields.js.
const VARIANTS = {
  cristal: {
    heading: 'text-2xl font-bold text-purple-300',
    toggle:
      'text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-purple-400/40 text-purple-100 transition-colors',
    group: 'text-sm font-semibold uppercase tracking-wide text-purple-200/80 mb-2',
    item: 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-400/30',
    label: 'text-purple-300 font-semibold',
    rating: 'text-yellow-400 font-semibold',
    date: 'text-xs text-gray-400',
    text: 'text-gray-300 leading-relaxed',
    empty: 'text-gray-400 italic',
  },
  vinieta: {
    heading: 'text-xl font-black uppercase border-b-2 border-black dark:border-gray-500 inline-block',
    toggle:
      'text-xs font-black uppercase px-3 py-1 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] hover:translate-y-0.5 transition-transform',
    group: 'font-black uppercase text-sm mb-2 text-blue-600 dark:text-blue-400',
    item: 'border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]',
    label: 'font-black text-xs uppercase text-gray-500 dark:text-gray-300',
    rating: 'font-black text-red-600 dark:text-red-400',
    date: 'text-xs font-bold text-gray-400',
    text: 'font-medium',
    empty: 'font-bold text-gray-500 dark:text-gray-400',
  },
  libro: {
    heading: 'text-2xl font-bold border-b-2 border-stone-800 dark:border-stone-500 inline-block',
    toggle: '',
    group: 'font-bold text-sm uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2',
    item: 'border-l-2 border-stone-400 dark:border-stone-600 pl-3 break-inside-avoid',
    label: 'font-bold text-stone-900 dark:text-stone-100',
    rating: 'font-bold text-amber-800 dark:text-amber-300',
    date: 'text-xs text-stone-500 dark:text-stone-400',
    text: 'leading-relaxed',
    empty: 'italic text-stone-500 dark:text-stone-400',
  },
};

const EntriesBlock = ({
  entries,
  schema,
  variant = 'cristal',
  // El modal de novelas pagina con columnas CSS y sólo recalcula las páginas al
  // redimensionar: si esto se plegase, el contador de páginas mentiría.
  collapsible = true,
  className = 'mb-6',
}) => {
  const styles = VARIANTS[variant] ?? VARIANTS.cristal;
  const diary = buildDiary(entries, schema.levels);
  const [open, setOpen] = useState(!collapsible);

  // Sin una sola entrada no pintamos ni la cabecera: una ficha sin diario no
  // tiene por qué enseñar un hueco que dice que está vacía.
  if (diary.total === 0) return null;

  const isOpen = collapsible ? open : true;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className={styles.heading}>{schema.diaryTitle}</h3>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={isOpen}
            className={styles.toggle}
          >
            {isOpen ? 'Ocultar' : `Ver ${schema.countLabel(diary.total)}`}
          </button>
        ) : (
          <span className={styles.date}>{schema.countLabel(diary.total)}</span>
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-4">
          {diary.groups.map((group) => (
            <div key={group.key}>
              {diary.grouped && <p className={styles.group}>{group.label}</p>}
              <div className="flex flex-col gap-3">
                {group.items.map(({ entry, key, label }) => {
                  const rating = entryRating(entry);
                  return (
                    <div key={key} className={styles.item}>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                        {label && <span className={styles.label}>{label}</span>}
                        {rating !== null && (
                          <span className={styles.rating}>{formatRating(rating)}</span>
                        )}
                        {entry.date && <span className={styles.date}>{entry.date}</span>}
                      </div>
                      {entry.text && <p className={styles.text}>{entry.text}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EntriesBlock;
