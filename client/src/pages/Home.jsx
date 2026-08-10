import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SongCard from "../components/SongCard.jsx";
import {
  SearchIcon,
  MusicIcon,
  SparklesIcon,
} from "../components/icons/Icons.jsx";
import { getCategories, getSongs } from "../services/api.js";
import { useTheme } from "../context/ThemeContext.jsx";

const POPULAR_ARTISTS = [
  { name: "Anuv Jain", tag: "Indie Vocalist" },
  { name: "Arijit Singh", tag: "Bollywood Royalty" },
  { name: "Darshan Raval", tag: "Romantic Hits" },
  { name: "Armaan Malik", tag: "Pop & Melodies" },
  { name: "Jubin Nautiyal", tag: "Soulful Vocals" },
  { name: "Atif Aslam", tag: "Classic Belter" },
  { name: "Vishal Mishra", tag: "Emotional Ballads" },
  { name: "Mohit Chauhan", tag: "Sufi & Folk" },
  { name: "Sonu Nigam", tag: "Master Vocalist" },
  { name: "Shreya Ghoshal", tag: "Nightingale" },
  { name: "Sunidhi Chauhan", tag: "Powerhouse" },
  { name: "Neha Kakkar", tag: "Party Anthems" },
  { name: "King", tag: "Hindi Hip-Hop" },
  { name: "Prateek Kuhad", tag: "Acoustic Indie" },
  { name: "KK", tag: "Legendary Rock" },
  { name: "Kumar Sanu", tag: "90s Gold" },
  { name: "Udit Narayan", tag: "Evergreen Voice" },
  { name: "Alka Yagnik", tag: "Melodious Era" },
];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [songs, setSongs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { activeCategorySlug, setActiveCategorySlug, theme } = useTheme();

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (err) {
        console.error("Error loading categories:", err);
      }
    };
    loadCategories();
  }, []);

  const activeCategory = categories.find((c) => c.slug === activeCategorySlug);
  const activeCategorySlugNormalized =
    activeCategorySlug === "default" || activeCategorySlug === "for-you"
      ? ""
      : activeCategorySlug;

  // Dynamic search execution against YouTube API
  const fetchSongs = useCallback(
    async (isLoadMore = false) => {
      try {
        setLoading(true);
        setError(null);

        const targetPage = isLoadMore ? page + 1 : 1;

        const params = {
          page: targetPage,
          limit: 25,
        };

        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }
        if (activeCategorySlugNormalized) {
          params.category = activeCategorySlugNormalized;
        }
        if (selectedArtist) {
          params.artist = selectedArtist;
        }

        const results = await getSongs(params);

        if (isLoadMore) {
          setSongs((prev) => [...prev, ...results]);
          setPage(targetPage);
        } else {
          setSongs(results);
          setPage(1);
        }

        setHasMore(results.length >= 25);
      } catch (err) {
        console.error("Failed to fetch songs from YouTube API:", err);
        setError("Unable to retrieve tracks from YouTube Data API.");
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, activeCategorySlugNormalized, selectedArtist, page],
  );

  // Debounced effect when search/filters change
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSongs(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, activeCategorySlugNormalized, selectedArtist]);

  const handleArtistClick = (artistName) => {
    if (selectedArtist === artistName) {
      setSelectedArtist("");
    } else {
      setSelectedArtist(artistName);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedArtist("");
    setActiveCategorySlug("for-you");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto pb-16"
    >
      {/* Header & Search */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-2xl"
            style={{
              backgroundColor: theme.primary,
              boxShadow: `0 0 20px ${theme.glow}`,
            }}
          >
            <MusicIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Music
            </h1>
          </div>
        </div>

        <div className="relative w-full md:w-96">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search Arijit Singh, Anuv Jain, Bollywood hits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/10 rounded-full py-3 pl-12 pr-10 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 backdrop-blur-md transition-all"
            style={{ "--tw-ring-color": theme.primary }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* Popular Artists Carousel */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-amber-400" />
            Popular Hindi Vocalists
          </h2>
          {selectedArtist && (
            <button
              onClick={() => setSelectedArtist("")}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Clear Artist ({selectedArtist})
            </button>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3 snap-x hide-scrollbar">
          {POPULAR_ARTISTS.map((artist) => {
            const isSelected = selectedArtist === artist.name;
            return (
              <button
                key={artist.name}
                onClick={() => handleArtistClick(artist.name)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-left transition-all border backdrop-blur-md snap-start flex flex-col justify-between ${
                  isSelected
                    ? "text-white border-red-400/50 shadow-lg"
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: theme.primary,
                        boxShadow: `0 0 15px ${theme.glow}`,
                      }
                    : {}
                }
              >
                <span className="font-semibold text-sm block">
                  {artist.name}
                </span>
                <span className="text-[10px] text-gray-400 opacity-80 block">
                  {artist.tag}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Category Tabs */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Categories</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x hide-scrollbar">
          {categories.map((category) => {
            const isActive =
              activeCategorySlug === category.slug ||
              (category.slug === "for-you" && activeCategorySlug === "default");
            return (
              <button
                key={category._id || category.slug}
                onClick={() => setActiveCategorySlug(category.slug)}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all border backdrop-blur-md snap-start ${
                  isActive
                    ? "text-white"
                    : "bg-white/5 border-transparent text-gray-300 hover:bg-white/10"
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.accent,
                        boxShadow: `0 0 15px ${theme.glow}`,
                      }
                    : {}
                }
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Track Listing Header & Active Filters */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : selectedArtist
                  ? `${selectedArtist} Videos`
                  : activeCategory?.name || "Popular Hindi Music Videos"}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Official YouTube Data API v3 • Official YouTube Embedded Player
            </p>
          </div>

          {(searchQuery ||
            selectedArtist ||
            (activeCategorySlug !== "default" &&
              activeCategorySlug !== "for-you")) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Active filters:</span>
              {activeCategory?.name &&
                activeCategorySlug !== "for-you" &&
                activeCategorySlug !== "default" && (
                  <span className="bg-white/10 text-xs px-2.5 py-1 rounded-full text-gray-200 border border-white/10">
                    Category: {activeCategory.name}
                  </span>
                )}
              {selectedArtist && (
                <span className="bg-white/10 text-xs px-2.5 py-1 rounded-full text-gray-200 border border-white/10">
                  Artist: {selectedArtist}
                </span>
              )}
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-400 hover:text-rose-300 underline ml-2"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {loading && songs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div
              className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
              style={{ borderColor: theme.primary }}
            ></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 bg-white/5 rounded-3xl border border-white/10">
            <p className="text-lg text-rose-300 mb-4">{error}</p>
            <button
              onClick={() => fetchSongs(false)}
              className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
              style={{ backgroundColor: theme.primary }}
            >
              Retry YouTube Fetch
            </button>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm px-6">
            <MusicIcon className="w-16 h-16 mx-auto mb-4 text-gray-500 opacity-40" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No Suitable YouTube Songs Found
            </h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
              {activeCategory?.name &&
              activeCategorySlug !== "for-you" &&
              activeCategorySlug !== "default"
                ? `No suitable ${activeCategory.name} YouTube videos found.`
                : "No suitable YouTube songs found for your query."}
            </p>
            <button
              onClick={handleResetFilters}
              className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
            >
              Clear Filters & View Catalog
            </button>
          </div>
        ) : (
          <>
            <motion.div
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6"
            >
              <AnimatePresence>
                {songs.map((song) => (
                  <SongCard
                    key={song.youtubeVideoId || song.id || song._id}
                    song={song}
                    playlist={songs}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => fetchSongs(true)}
                  disabled={loading}
                  className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all shadow-lg"
                >
                  {loading ? "Loading More..." : "Load More Songs"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </motion.div>
  );
}
