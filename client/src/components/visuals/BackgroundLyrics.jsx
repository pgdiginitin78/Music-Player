import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { useMusic } from '../../context/MusicContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { CloseIcon, MusicIcon } from '../icons/Icons.jsx';
import { fetchLyrics, parseYouTubeTitle } from '../../services/lyricsService.js';
import { getSongThumbnail } from '../../services/songNormalizer.js';

/* ─────────────────────────────────────────────────────────── */
export default function BackgroundLyrics() {
  const { currentSong, currentTime, actualDuration, showLyrics, setShowLyrics } = useMusic();
  const { theme } = useTheme();

  // lyrics data
  const [lines, setLines] = useState([]);
  const [lyricsStatus, setLyricsStatus] = useState('idle'); // idle | loading | found | not_found | error
  const [parsedInfo, setParsedInfo] = useState({ songName: '', artist: '' });

  // refs for Lenis + auto-scroll
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const lenisRef = useRef(null);
  const rafRef = useRef(null);

  // request tracking — AbortController + request ID to prevent stale responses
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const retryCountRef = useRef(0);

  /* ── Song key — unique per song ──────────────────────────── */
  const getSongKey = (song) => [
    song?.youtubeVideoId || song?._id || song?.id || '',
    song?.title || '',
    song?.artist || '',
  ].join('::');

  /* ── Fetch lyrics ──────────────────────────────────────────
     Called when: song changes OR user presses Retry.
  ── */
  const loadLyrics = (song, retryId = 0) => {
    if (!song || !showLyrics) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const myRequestId = ++requestIdRef.current;

    const info = parseYouTubeTitle(song.title, song.artist);
    setParsedInfo(info);
    setLyricsStatus('loading');
    setLines([]);

    fetchLyrics(song, controller.signal)
      .then((result) => {
        // Guard: ignore if song changed or a newer request was made
        if (myRequestId !== requestIdRef.current) return;

        if (result && result.length > 0) {
          setLines(result);
          setLyricsStatus('found');
        } else {
          setLines([]);
          setLyricsStatus('not_found');
        }
      })
      .catch((err) => {
        if (myRequestId !== requestIdRef.current) return;
        if (err?.name === 'AbortError') return; // intentional cancel — ignore

        console.warn('[LYRICS] Fetch error:', err?.message);
        setLines([]);
        setLyricsStatus('error');
      });
  };

  /* ── Re-fetch when song or panel opens ───────────────────── */
  const lastSongKeyRef = useRef('');

  useEffect(() => {
    if (!showLyrics || !currentSong) return;

    const key = getSongKey(currentSong);
    if (key === lastSongKeyRef.current && lyricsStatus !== 'idle') return; // same song, already fetched
    lastSongKeyRef.current = key;
    retryCountRef.current = 0;
    loadLyrics(currentSong);
  }, [currentSong, showLyrics]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Reset on song change so next open re-fetches ─────────── */
  useEffect(() => {
    if (!currentSong) return;
    const key = getSongKey(currentSong);
    if (key !== lastSongKeyRef.current) {
      lastSongKeyRef.current = '';
      setLyricsStatus('idle');
      setLines([]);
    }
  }, [currentSong]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cleanup abort on unmount ────────────────────────────── */
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  /* ── Active line index ─────────────────────────────────────
     Use actualDuration from player if available, else song.duration.
  ── */
  const totalDuration = (actualDuration > 0 ? actualDuration : currentSong?.duration) || 0;
  const activeIdx = lines.length > 0 && totalDuration > 0
    ? Math.min(lines.length - 1, Math.max(0, Math.floor((currentTime / totalDuration) * lines.length)))
    : 0;

  /* ── Lenis smooth scroller ────────────────────────────────── */
  useEffect(() => {
    if (!showLyrics || !containerRef.current || lyricsStatus !== 'found') return;

    const lenis = new Lenis({
      wrapper: containerRef.current,
      content: containerRef.current.querySelector('[data-lyrics-inner]'),
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: false,
      touchMultiplier: 0,
    });

    lenisRef.current = lenis;
    const raf = (time) => { lenis.raf(time); rafRef.current = requestAnimationFrame(raf); };
    rafRef.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [showLyrics, lyricsStatus]);

  /* ── Auto-scroll to active line ────────────────────────────── */
  useEffect(() => {
    const el = lineRefs.current[activeIdx];
    const container = containerRef.current;
    const lenis = lenisRef.current;
    if (!el || !container || !lenis) return;

    const target = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    lenis.scrollTo(target, { immediate: false });
  }, [activeIdx]);

  if (!showLyrics || !currentSong) return null;

  /* ── Retry handler ─────────────────────────────────────────── */
  const handleRetry = () => {
    retryCountRef.current += 1;
    loadLyrics(currentSong, retryCountRef.current);
  };

  const thumbnailSrc = getSongThumbnail(currentSong);

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed inset-0 z-40 flex flex-col pointer-events-auto overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(50px)' }}
      >
        {/* Ambient artwork glow */}
        <div
          className="absolute inset-0 -z-10 scale-125"
          style={{
            backgroundImage: `url(${thumbnailSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(70px)',
            opacity: 0.15,
            transition: 'background-image 1s ease',
          }}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, ${theme.primary}88, transparent 65%)`,
            opacity: 0.25,
          }}
        />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-5 z-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xl border border-white/10 flex-shrink-0">
              <img
                src={thumbnailSrc}
                alt={currentSong.title}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  if (currentSong?.youtubeVideoId && !e.currentTarget.src.includes('hqdefault')) {
                    e.currentTarget.src = `https://i.ytimg.com/vi/${currentSong.youtubeVideoId}/hqdefault.jpg`;
                  } else {
                    e.currentTarget.src = "/images/default-album.webp";
                  }
                }}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base truncate max-w-xs">
                {parsedInfo.songName || currentSong.title}
              </h3>
              <p className="text-xs text-gray-400 truncate max-w-xs">
                {parsedInfo.artist || currentSong.artist}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lyricsStatus === 'found' && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-purple-300 font-semibold tracking-widest uppercase">
                <MusicIcon className="w-3.5 h-3.5 animate-bounce" />
                Live Lyrics
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowLyrics(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur border border-white/10 transition-all hover:scale-105"
            >
              <CloseIcon className="w-4 h-4" />
              <span>Hide</span>
            </button>
          </div>
        </div>

        {/* Fade masks */}
        <div
          className="absolute left-0 right-0 top-20 h-28 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.90), transparent)' }}
        />
        <div
          className="absolute left-0 right-0 bottom-0 h-36 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)' }}
        />

        {/* ── Loading ── */}
        {lyricsStatus === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-10 h-10 rounded-full border-2 animate-spin"
              style={{ borderColor: `${theme.accent} transparent transparent transparent` }}
            />
            <p className="text-sm text-gray-400 tracking-widest uppercase animate-pulse">
              Fetching lyrics…
            </p>
          </div>
        )}

        {/* ── Not found ── */}
        {lyricsStatus === 'not_found' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <MusicIcon className="w-12 h-12 text-white/20" />
            <p className="text-lg font-semibold text-white/50">Lyrics not available</p>
            <p className="text-sm text-gray-500 max-w-xs">
              No lyrics found for{' '}
              <span className="text-purple-300 font-medium">
                {parsedInfo.songName || currentSong.title}
              </span>
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {lyricsStatus === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <MusicIcon className="w-12 h-12 text-red-400/40" />
            <p className="text-lg font-semibold text-white/50">Unable to load lyrics</p>
            <p className="text-sm text-gray-500 max-w-xs">
              A network or provider error occurred.
            </p>
            <button
              onClick={handleRetry}
              className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: theme.primary, boxShadow: `0 4px 14px ${theme.glow}` }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Lyrics scroll ── */}
        {lyricsStatus === 'found' && (
          <>
            <style>{`[data-lyrics-scroller]::-webkit-scrollbar { display: none; }`}</style>
            <div
              ref={containerRef}
              data-lyrics-scroller
              className="flex-1"
              style={{ overflowY: 'scroll', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div
                data-lyrics-inner
                className="flex flex-col items-center gap-7 max-w-2xl mx-auto px-6 md:px-0"
              >
                {/* Spacer — first line can reach center */}
                <div style={{ height: '45vh', flexShrink: 0 }} />

                {lines.map((line, idx) => {
                  const isActive = idx === activeIdx;
                  const distance = Math.abs(idx - activeIdx);
                  const opacity = isActive ? 1 : Math.max(0.1, 0.5 - distance * 0.1);
                  const scale = isActive ? 1.07 : Math.max(0.8, 1 - distance * 0.05);

                  return (
                    <motion.p
                      key={`${getSongKey(currentSong)}-${idx}`}
                      ref={(el) => { lineRefs.current[idx] = el; }}
                      animate={{ opacity, scale }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className={`text-center leading-relaxed select-none ${
                        isActive
                          ? 'text-2xl md:text-[2.2rem] font-extrabold tracking-wide'
                          : 'text-base md:text-xl font-normal'
                      }`}
                      style={{
                        color: isActive ? theme.accent : '#a78bfa',
                        textShadow: isActive
                          ? `0 0 50px ${theme.glow}, 0 0 20px ${theme.primary}`
                          : 'none',
                        willChange: 'opacity, transform',
                      }}
                    >
                      {line}
                    </motion.p>
                  );
                })}

                {/* Spacer — last line can reach center */}
                <div style={{ height: '50vh', flexShrink: 0 }} />
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
