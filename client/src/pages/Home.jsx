import { useState, useEffect, useCallback, useRef } from "react";
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
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState("");

  // ── Independent loading states ──────────────────────────────────────────────
  // isSongsLoading: true only for the initial fetch (no songs yet)
  const [isSongsLoading, setIsSongsLoading] = useState(false);
  // isLoadingMore: true only when loading additional pages (songs already visible)
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // ── Page tracking via ref (avoids fetchSongs re-creation on page change) ──
  const pageRef = useRef(1);

  // ── Inflight request tracking — one AbortController per fetch cycle ────────
  // When a new fetch starts, we abort the previous one.
  // This guarantees the finally { setLoading(false) } of the aborted call
  // runs immediately and never blocks the UI.
  const fetchAbortRef = useRef(null);

  const { activeCategorySlug, setActiveCategorySlug, theme } = useTheme();

  // ── Load categories (fire and forget — never blocks song loading) ──────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cats = await getCategories();
        if (!cancelled) setCategories(cats);
      } catch (err) {
        // Categories failing must NEVER block the rest of the app
        if (!cancelled) console.warn("[HOME] Categories load failed:", err.message);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // run once

  const activeCategorySlugNormalized =
    activeCategorySlug === "default" || activeCategorySlug === "for-you"
      ? ""
      : activeCategorySlug;

  const activeCategory = categories.find((c) => c.slug === activeCategorySlug);

  // ── Core song fetcher ───────────────────────────────────────────────────────
  // IMPORTANT: This function:
  //   1. Aborts any previous inflight request
  //   2. Always calls setLoading(false) in finally — even on abort/timeout/error
  //   3. Ignores AbortError responses (they are intentional cancellations)
  const fetchSongs = useCallback(
    async (isLoadMore = false) => {
      // Abort any currently inflight request
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      const targetPage = isLoadMore ? pageRef.current + 1 : 1;

      // Show the right loading indicator:
      // - isSongsLoading: full-area spinner (only when no songs are shown yet)
      // - isLoadingMore: small spinner on the "Load More" button
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsSongsLoading(true);
        setError(null);
      }

      try {
        const params = { page: targetPage, limit: 25 };
        if (searchQuery.trim())           params.search   = searchQuery.trim();
        if (activeCategorySlugNormalized) params.category = activeCategorySlugNormalized;
        if (selectedArtist)               params.artist   = selectedArtist;

        const results = await getSongs(params, controller.signal);

        // Ignore result if this request was intentionally aborted
        if (controller.signal.aborted) return;

        if (isLoadMore) {
          setSongs((prev) => [...prev, ...results]);
          pageRef.current = targetPage;
        } else {
          setSongs(results);
          pageRef.current = 1;
        }

        setHasMore(results.length >= 25);
      } catch (err) {
        // AbortError = intentional cancel (new search/category started) — not an error
        if (err.name === "AbortError") return;

        console.error("[HOME] Failed to fetch songs:", err.message);
        setError("Unable to load songs. Please check your connection and try again.");
      } finally {
        // Always clear loading — even on abort (abort means a new request is
        // already inflight and will set its own loading state)
        if (!controller.signal.aborted) {
          setIsSongsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [searchQuery, activeCategorySlugNormalized, selectedArtist]
    // NOTE: page intentionally excluded — read via pageRef.current
  );

  // ── Debounced fetch on filter/search/category change ─────────────────────
  useEffect(() => {
    // 300ms debounce to avoid firing on every keystroke
    const handler = setTimeout(() => {
      fetchSongs(false);
    }, 300);

    return () => {
      clearTimeout(handler);
      // Also abort any pending request when dependencies change
      // (e.g., user types quickly — cancel the previous fetch)
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [searchQuery, activeCategorySlugNormalized, selectedArtist]);
  // NOTE: fetchSongs intentionally excluded to avoid double-firing.
  // It only changes when the same deps change, so including it would
  // cause the effect to run an extra time with no benefit.

  // Cleanup on unmount
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

  // Combined loading flag for UI: only show full spinner when no songs exist yet
  const showFullSpinner = isSongsLoading && songs.length === 0;

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
              type="button"
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

      {/* Track Listing */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : selectedArtist
                  ? `${selectedArtist} Tracks`
                  : activeCategory?.name || "Popular Hindi Music"}
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

        {/* ── Loading: full-area spinner only when no songs exist yet ── */}
        {showFullSpinner ? (
          <div className="flex items-center justify-center h-64">
            <div
              className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
              style={{ borderColor: theme.primary }}
            />
          </div>
        ) : error ? (
          /* ── Error state ── */
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
          /* ── Empty state ── */
          <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm px-6">
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
          </div>
        ) : (
          /* ── Song grid ── */
          <>
            {/* Subtle overlay spinner when reloading existing content */}
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
