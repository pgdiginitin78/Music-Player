import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SongCard from "../components/SongCard.jsx";
import {
  SearchIcon,
  MusicIcon,
  SparklesIcon,
  HeartIcon,
} from "../components/icons/Icons.jsx";
import { getCategories, getSongs, getRecommendations } from "../services/api.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { useMusic } from "../context/MusicContext.jsx";

const PAGE_SIZE = 25;

const POPULAR_ARTISTS = [
  { name: "Anuv Jain", tag: "Indie Vocalist" },
  { name: "Arijit Singh", tag: "Bollywood Royalty" },
  { name: "Darshan Raval", tag: "Romantic Hits" },
  { name: "Armaan Malik", tag: "Pop & Melodies" },
  { name: "Jubin Nautiyal", tag: "Soulful Vocals" },
  { name: "Atif Aslam", tag: "Classic Belter" },
  { name: "Vishal Mishra", tag: "Emotional Ballads" },
  { name: "Mohit Chauhan", tag: "Sufi & Folk" },
  { name: "Shreya Ghoshal", tag: "Nightingale" },
  { name: "Sunidhi Chauhan", tag: "Powerhouse" },
  { name: "Neha Kakkar", tag: "Party Anthems" },
  { name: "King", tag: "Hindi Hip-Hop" },
  { name: "Prateek Kuhad", tag: "Acoustic Indie" },
  { name: "KK", tag: "Legendary Rock" },
  { name: "Karan Aujla", tag: "Punjabi Trendsetter" },
  { name: "Alka Yagnik", tag: "Melodious Era" },
  { name: "Kaka", tag: "Punjabi Heartbreak" },
  { name: "AP Dhillon", tag: "Punjabi Wave" },
  { name: "Divine", tag: "Desi Hip-Hop" },
  { name: "Sambata", tag: "Rising Talent" },
];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [songs, setSongs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState("");
  const [isSongsLoading, setIsSongsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const nextPageTokenRef = useRef(null);

  const fetchAbortRef = useRef(null);

  const { activeCategorySlug, setActiveCategorySlug, theme } = useTheme();
  const { likedSongs } = useMusic();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cats = await getCategories();
        if (!cancelled) setCategories(cats);
      } catch (err) {
        if (!cancelled)
          console.warn("[HOME] Categories load failed:", err.message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategorySlugNormalized =
    activeCategorySlug === "default" || activeCategorySlug === "for-you"
      ? ""
      : activeCategorySlug;

  const activeCategory = categories.find((c) => c.slug === activeCategorySlug);

  const getSongKey = (s) => s.youtubeVideoId || s.id || s._id;

  const fetchSongs = useCallback(
    async (isLoadMore = false) => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setSongs([]);
        nextPageTokenRef.current = null;
        setIsSongsLoading(true);
        setError(null);
      }

      try {
        const params = { limit: PAGE_SIZE };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (activeCategorySlugNormalized)
          params.category = activeCategorySlugNormalized;
        if (selectedArtist) params.artist = selectedArtist;
        if (isLoadMore && nextPageTokenRef.current) {
          params.pageToken = nextPageTokenRef.current;
        }

        if (activeCategorySlug === "liked-music") {
          setSongs(likedSongs || []);
          setIsSongsLoading(false);
          setIsLoadingMore(false);
          return;
        }

        let result;
        const likedIds = likedSongs ? likedSongs.map(getSongKey) : [];

        if (!searchQuery.trim() && !selectedArtist && !isLoadMore) {
          if (
            activeCategorySlug === "for-you" ||
            activeCategorySlug === "default"
          ) {
            result = await getRecommendations(
              "for-you",
              likedIds,
              controller.signal,
            );
          } else if (activeCategorySlug === "trending-hindi") {
            result = await getRecommendations(
              "trending",
              likedIds,
              controller.signal,
            );
          } else if (activeCategorySlug === "latest-hindi") {
            result = await getRecommendations(
              "new",
              likedIds,
              controller.signal,
            );
          } else {
            result = await getSongs(params, controller.signal);
          }
        } else {
          result = await getSongs(params, controller.signal);
        }

        if (controller.signal.aborted) return;

        if (isLoadMore) {
          setSongs((prev) => {
            const seen = new Set(prev.map(getSongKey));
            const deduped = result.songs.filter(
              (s) => !seen.has(getSongKey(s)),
            );
            return [...prev, ...deduped];
          });
        } else {
          setSongs(result.songs);
        }

        nextPageTokenRef.current = result.nextPageToken;
        setHasMore(result.hasMore);
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error("[HOME] Failed to fetch songs:", err.message);
        setError(
          "Unable to load songs. Please check your connection and try again.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSongsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [searchQuery, activeCategorySlugNormalized, selectedArtist],
  );
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSongs(false);
    }, 300);

    return () => {
      clearTimeout(handler);
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [searchQuery, activeCategorySlugNormalized, selectedArtist]);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, []);

  const handleArtistClick = (artistName) => {
    setSelectedArtist((prev) => (prev === artistName ? "" : artistName));
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedArtist("");
    setActiveCategorySlug("for-you");
  };

  const showFullSpinner = isSongsLoading && songs.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto pb-16"
    >
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
      </header>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-amber-400" />
            Popular Hindi Vocalists
          </h2>
          {selectedArtist && (
            <button
              type="button"
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
                type="button"
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
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Categories</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x hide-scrollbar">
          {/* Liked Songs Special Category Pill */}
          <button
            type="button"
            onClick={() => setActiveCategorySlug("liked-music")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all border backdrop-blur-md snap-start flex items-center gap-2 ${
              activeCategorySlug === "liked-music"
                ? "text-white"
                : "bg-white/5 border-transparent text-gray-300 hover:bg-white/10"
            }`}
            style={
              activeCategorySlug === "liked-music"
                ? {
                    backgroundColor: theme.primary,
                    borderColor: theme.accent,
                    boxShadow: `0 0 15px ${theme.glow}`,
                  }
                : {}
            }
          >
            <HeartIcon
              filled={activeCategorySlug === "liked-music"}
              className={`w-4 h-4 ${activeCategorySlug === "liked-music" ? "text-rose-400" : "text-gray-400"}`}
            />
            <span>Liked Music ({likedSongs ? likedSongs.length : 0})</span>
          </button>

          {categories.map((category) => {
            const isActive =
              activeCategorySlug === category.slug ||
              (category.slug === "for-you" && activeCategorySlug === "default");
            return (
              <button
                key={category._id || category.slug}
                type="button"
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
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              {activeCategorySlug === "liked-music" ? (
                <>
                  <HeartIcon filled className="w-6 h-6 text-rose-400" />
                  Your Liked Songs ({likedSongs ? likedSongs.length : 0})
                </>
              ) : searchQuery ? (
                `Results for "${searchQuery}"`
              ) : selectedArtist ? (
                `${selectedArtist} Tracks`
              ) : (
                activeCategory?.name || "Popular Hindi Music"
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              High Quality Audio Engine • Synchronized Lyrics Supported
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
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-400 hover:text-rose-300 underline ml-2"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {showFullSpinner ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="relative rounded-xl p-4 bg-white/5 border border-transparent overflow-hidden animate-pulse"
              >
                <div className="relative aspect-square rounded-lg bg-white/10 mb-3"></div>
                <div>
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-1/2 mb-1"></div>
                  <div className="h-2 bg-white/10 rounded w-1/3 mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 bg-white/5 rounded-3xl border border-white/10">
            <p className="text-lg text-rose-300 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchSongs(false)}
              className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
              style={{ backgroundColor: theme.primary }}
            >
              Retry
            </button>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm px-6">
            {activeCategorySlug === "liked-music" ? (
              <>
                <HeartIcon className="w-16 h-16 mx-auto mb-4 text-rose-400 opacity-60 animate-pulse" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  No Liked Songs Yet
                </h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                  Click the heart icon on any song card or player bar to save your favorite music here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveCategorySlug("for-you")}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all"
                  style={{ backgroundColor: theme.primary, boxShadow: `0 0 15px ${theme.glow}` }}
                >
                  Explore For You Recommendations
                </button>
              </>
            ) : (
              <>
                <MusicIcon className="w-16 h-16 mx-auto mb-4 text-gray-500 opacity-40" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  No Songs Found
                </h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                  {activeCategory?.name &&
                  activeCategorySlug !== "for-you" &&
                  activeCategorySlug !== "default"
                    ? `No suitable ${activeCategory.name} videos found.`
                    : "No suitable songs found for your query."}
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
                >
                  Clear Filters & View Catalog
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {isSongsLoading && songs.length > 0 && (
              <div className="flex justify-center mb-4">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 opacity-60"
                  style={{ borderColor: theme.primary }}
                />
              </div>
            )}
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
                  type="button"
                  onClick={() => fetchSongs(true)}
                  disabled={isLoadingMore}
                  className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all shadow-lg disabled:opacity-60"
                >
                  {isLoadingMore ? "Loading More..." : "Load More Songs"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </motion.div>
  );
}
