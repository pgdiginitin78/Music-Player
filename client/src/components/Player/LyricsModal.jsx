import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, MusicIcon } from '../icons/Icons.jsx';
import { fetchLyrics } from '../../services/lyricsService.js';
import { alignLyricsToDuration, getActiveLineIndex } from '../../services/lyricsAlignerService.js';

export default function LyricsModal({ isOpen, onClose, currentSong, currentTime = 0, theme }) {
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [found, setFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchAbortRef = useRef(null);

  const totalDuration = currentSong?.duration || 210;

  const alignedLines = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];
    return alignLyricsToDuration(lyrics, totalDuration);
  }, [lyrics, totalDuration]);

  const activeIdx = useMemo(() => {
    if (alignedLines.length === 0) return 0;
    return getActiveLineIndex(alignedLines, currentTime);
  }, [alignedLines, currentTime]);

  const loadLyricsForSong = async () => {
    if (!currentSong) return;

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setLyrics(null);
    setFound(false);
    setErrorMessage(null);

    try {
      const data = await fetchLyrics(currentSong, controller.signal);
      if (controller.signal.aborted) return;

      if (data.success && data.found && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
        setLyrics(data.lyrics);
        setFound(true);
      } else if (data.success && !data.found) {
        setFound(false);
        setLyrics(null);
      } else {
        setErrorMessage(data.message || 'Unable to load lyrics');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[LYRICS MODAL] Fetch error:', err.message);
      setErrorMessage('Unable to load lyrics');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen && currentSong) {
      loadLyricsForSong();
    }

    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [isOpen, currentSong?.id || currentSong?.youtubeVideoId || currentSong?.title]);

  if (!isOpen || !currentSong) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-gray-900/90 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden text-center max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-3 text-left min-w-0">
              <img 
                src={currentSong.coverImage || "/images/default-album.webp"} 
                alt={currentSong.title} 
                className="w-12 h-12 rounded-xl object-cover shadow-md flex-shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-bold text-white text-base md:text-lg truncate">{currentSong.title}</h3>
                <p className="text-xs md:text-sm text-gray-300 truncate">{currentSong.artist}</p>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
              title="Close Lyrics"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Lyrics Body */}
          <div className="flex-1 overflow-y-auto py-8 px-2 space-y-4 scrollbar-thin scrollbar-thumb-white/20 flex flex-col items-center min-h-[250px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 my-auto">
                <div 
                  className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2"
                  style={{ borderColor: theme?.accent || '#c4b5fd' }}
                />
                <p className="text-sm font-medium text-purple-300 animate-pulse flex items-center gap-2">
                  <MusicIcon className="w-4 h-4 animate-bounce" />
                  Loading lyrics...
                </p>
              </div>
            ) : errorMessage ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8 my-auto">
                <p className="text-base text-rose-400 font-medium">{errorMessage}</p>
                <button
                  type="button"
                  onClick={loadLyricsForSong}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
                  style={{ backgroundColor: theme?.primary }}
                >
                  Retry
                </button>
              </div>
            ) : !found || !lyrics || lyrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4 my-auto">
                <MusicIcon className="w-12 h-12 text-gray-600 opacity-40 mb-2" />
                <h4 className="text-lg font-semibold text-gray-200">Lyrics unavailable for this song</h4>
                <p className="text-xs text-gray-400 max-w-sm">
                  We couldn't find verified lyrics for "{currentSong.title}".
                </p>
              </div>
            ) : (
              <div className="w-full space-y-4 my-auto text-center">
                {lyrics.map((line, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <p
                      key={idx}
                      className={`text-base md:text-xl font-medium transition-all duration-300 cursor-default ${
                        isActive
                          ? 'text-white font-bold scale-105 drop-shadow-[0_0_12px_rgba(196,181,253,0.8)]'
                          : 'text-gray-400/70 hover:text-gray-200'
                      }`}
                      style={isActive ? { color: theme?.accent || '#c4b5fd' } : {}}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-white/10 text-xs text-gray-400 flex items-center justify-between">
            <span>Verified AI Aligned Lyrics</span>
            <span className="font-mono text-purple-300">Duration Sync Active</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
