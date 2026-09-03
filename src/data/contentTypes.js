import AnimeModal from '../components/AnimeModal';
import MangaModal from '../components/MangaModal';
import LightNovelModal from '../components/LightNovelModal';

// Registro de tipos de contenido. Añadir una sección nueva (películas, doujinshi,
// lo que sea) es: un JSON en public/data/, un modal, y una entrada aquí. Nada más.
// Antes había que tocar cinco cadenas ternarias distintas en App.jsx.
export const CONTENT_TYPES = {
  anime: {
    id: 'anime',
    slug: 'anime',
    file: 'anime.json',
    pageTitle: "Carlos' Opinion",
    pageDescription:
      'La página web en la que Carlos comparte su opinión sobre animes que ha visto, está viendo, verá, o ha abandonado.',
    searchPlaceholder: 'Buscar anime por título...',
    navTitle: "Carlos' Anime Opinion",
    navDescription: 'Opiniones y reseñas sobre series y películas de anime.',
    Modal: AnimeModal,
  },
  manga: {
    id: 'manga',
    slug: 'manga',
    file: 'manga.json',
    pageTitle: "Carlos' Manga Opinion",
    pageDescription:
      'La página web en la que Carlos comparte su opinión sobre mangas que ha leído, está leyendo o ha abandonado.',
    searchPlaceholder: 'Buscar manga por título...',
    navTitle: "Carlos' Manga Opinion",
    navDescription: 'Opiniones y viñetas sobre los mangas que leo.',
    Modal: MangaModal,
  },
  lightnovel: {
    id: 'lightnovel',
    slug: 'novelas',
    file: 'lightnovels.json',
    pageTitle: "Carlos' Light Novel Opinion",
    pageDescription:
      'La página web en la que Carlos comparte su opinión sobre novelas ligeras que ha leído, está leyendo o ha abandonado.',
    searchPlaceholder: 'Buscar novela ligera por título...',
    navTitle: "Carlos' Light Novel Opinion",
    navDescription: 'Reseñas literarias de novelas ligeras.',
    Modal: LightNovelModal,
  },
};

// Orden en el que aparecen en el modal de navegación.
export const CONTENT_TYPE_ORDER = ['anime', 'manga', 'lightnovel'];

export const DEFAULT_CONTENT_TYPE = 'anime';

// El `slug` es el trozo de URL de cada sección (/anime, /manga, /novelas). Va aquí
// para que añadir una sección siga siendo una sola entrada en este fichero: la ruta
// sale sola, no hay que tocar el router.
export const CONTENT_TYPE_BY_SLUG = Object.fromEntries(
  Object.values(CONTENT_TYPES).map((type) => [type.slug, type]),
);

export const DEFAULT_SLUG = CONTENT_TYPES[DEFAULT_CONTENT_TYPE].slug;
