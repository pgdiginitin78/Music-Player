import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SongCard from '../components/SongCard.jsx';
import { PrevIcon } from '../components/icons/Icons.jsx';
import { getCategoryBySlug, getSongs } from '../services/api.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { normalizeSong } from '../services/songNormalizer.js';

export default function CategoryView() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setActiveCategorySlug } = useTheme();

  const fetchCategoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        getCategoryBySlug(slug),
        getSongs({ category: slug, limit: 25 })
      ]);
      
      const catResult = results[0];
      const songsResult = results[1];

      if (catResult.status === 'fulfilled' && catResult.value) {
        setCategory(catResult.value);
      } else {
        // Fallback category header info if DB call failed
        const nameFormatted = (slug || '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setCategory({
          name: nameFormatted || 'Category',
          slug: slug,
          description: `Popular ${nameFormatted} Music`,
          wallpaper: `/wallpapers/${slug}.svg`
        });
      }

      if (songsResult.status === 'fulfilled' && Array.isArray(songsResult.value)) {
        setSongs(songsResult.value.map(normalizeSong).filter(Boolean));
      } else {
        setSongs([]);
      }
    } catch (err) {
      setError("Unable to load category music. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      setActiveCategorySlug(slug);
    }
    fetchCategoryData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <p className="text-xl text-gray-300 mb-6">{error}</p>
        <button 
          onClick={fetchCategoryData}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 transition-colors rounded-xl font-semibold text-white shadow-lg shadow-red-500/30"
        >
          Retry Connection
        </button>
        <Link to="/" className="mt-4 text-red-400 hover:text-red-300">Return Home</Link>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-2xl font-bold mb-4">Category not found</h2>
        <Link to="/" className="text-red-400 hover:text-red-300">Return Home</Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-8"
    >
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <PrevIcon className="w-5 h-5" />
        <span>Back to Discover</span>
      </Link>

      <div className="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-10 shadow-2xl">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1 }}
          src={category.wallpaper || `/wallpapers/${category.slug}.svg`} 
          alt={category.name} 
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = `/wallpapers/${category.slug}.svg`;
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold text-white mb-2 text-glow"
          >
            {category.name}
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-300"
          >
            {category.description}
          </motion.p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Videos</h2>
          <span className="text-gray-400">{songs.length} videos</span>
        </div>
        
        {songs.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {songs.map((song, idx) => (
              <motion.div
                key={song.youtubeVideoId || song.id || song._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <SongCard song={song} playlist={songs} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-12 bg-white/5 rounded-2xl border border-white/10">
            {`No suitable ${category.name} YouTube videos found.`}
          </div>
        )}
      </section>
    </motion.div>
  );
}
