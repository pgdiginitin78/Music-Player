import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { useMusic } from '../../context/MusicContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { CloseIcon, MusicIcon } from '../icons/Icons.jsx';
import { fetchLyrics, parseYouTubeTitle } from '../../services/lyricsService.js';

/* ─── Component ───────────────────────────────────────────── */
export default function BackgroundLyrics() {
  const { currentSong, currentTime, showLyrics, setShowLyrics } = useMusic();
  const { theme } = useTheme();

  const [lines, setLines] = useState([]);
  const [lyricsStatus, setLyricsStatus] = useState('idle'); // 'idle' | 'loading' | 'found' | 'not_found'
  const [parsedInfo, setParsedInfo] = useState({ songName: '', artist: '' });

  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const lenisRef = useRef(null);
  const rafRef = useRef(null);
  const fetchedForRef = useRef(null);

  /* ── Fetch real lyrics when song or panel opens ─────────── */
  useEffect(() => {
    if (!currentSong || !showLyrics) return;

    const songKey = currentSong._id || currentSong.id || currentSong.youtubeVideoId || currentSong.title;
    if (fetchedForRef.current === songKey) return;
    fetchedForRef.current = songKey;

    const info = parseYouTubeTitle(currentSong.title, currentSong.artist);
    setParsedInfo(info);
    setLyricsStatus('loading');
    setLines([]);

    fetchLyrics(currentSong).then((result) => {
      if (result && result.length > 0) {
        setLines(result);
        setLyricsStatus('found');
      } else {
        setLines([]);
        setLyricsStatus('not_found');
      }
    });
  }, [currentSong, showLyrics]);

  /* ── Reset fetch key on song change ─────────────────────── */
  useEffect(() => {
    if (!currentSong) return;
    const songKey = currentSong._id || currentSong.id || currentSong.youtubeVideoId || currentSong.title;
    if (fetchedForRef.current !== songKey) {
      fetchedForRef.current = null;
    }
  }, [currentSong]);

  /* ── Active line index ────────────────────────────────────  */
  const totalDuration = currentSong?.duration || 240;
  const activeIdx = lines.length > 0
    ? Math.min(lines.length - 1, Math.max(0, Math.floor((currentTime / totalDuration) * lines.length)))
    : 0;

  /* ── Lenis smooth scroller ───────────────────────────────── */
  useEffect(() => {
    if (!showLyrics || !containerRef.current) return;

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

  /* ── Auto-scroll to active line ──────────────────────────── */
  useEffect(() => {
    const activeLine = lineRefs.current[activeIdx];
    const container = containerRef.current;
    const lenis = lenisRef.current;
    if (!activeLine || !container || !lenis) return;

    const targetScrollTop =
      activeLine.offsetTop - container.clientHeight / 2 + activeLine.offsetHeight / 2;
    lenis.scrollTo(targetScrollTop, { immediate: false });
  }, [activeIdx]);

  if (!showLyrics || !currentSong) return null;

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
        {/* ── Ambient artwork glow ─────────────────────────── */}
        <div
          className="absolute inset-0 -z-10 opacity-15 scale-125"
          style={{
            backgroundImage: `url(${currentSong.coverImage || '/images/default-album.webp'})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(70px)',
            transition: 'background-image 1s ease',
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-25"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, ${theme.primary}99, transparent 65%)`,
          }}
        />

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-5 z-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xl border border-white/10 flex-shrink-0">
              <img
                src={currentSong.coverImage || '/images/default-album.webp'}
                alt={currentSong.title}
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
              onClick={() => setShowLyrics(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur border border-white/10 transition-all hover:scale-105"
            >
              <CloseIcon className="w-4 h-4" />
              <span>Hide</span>
            </button>
          </div>
        </div>

        {/* ── Top / bottom fade masks ──────────────────────── */}
        <div
          className="absolute left-0 right-0 top-20 h-28 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.90), transparent)' }}
        />
        <div
          className="absolute left-0 right-0 bottom-0 h-36 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)' }}
        />

        {/* ── Loading state ────────────────────────────────── */}
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

        {/* ── Not found state ──────────────────────────────── */}
        {lyricsStatus === 'not_found' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <MusicIcon className="w-12 h-12 text-white/20" />
            <p className="text-lg font-semibold text-white/50">Lyrics not available</p>
            <p className="text-sm text-gray-500 max-w-xs">
              Could not find lyrics for{' '}
              <span className="text-purple-300 font-medium">
                {parsedInfo.songName || currentSong.title}
              </span>
            </p>
          </div>
        )}

        {/* ── Lyrics scroll area ───────────────────────────── */}
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
                {/* Spacer — lets first line reach center */}
                <div style={{ height: '45vh', flexShrink: 0 }} />

                {lines.map((line, idx) => {
                  const isActive = idx === activeIdx;
                  const distance = Math.abs(idx - activeIdx);
                  const opacity = isActive ? 1 : Math.max(0.1, 0.5 - distance * 0.1);
                  const scale = isActive ? 1.07 : Math.max(0.8, 1 - distance * 0.05);

                  return (
                    <motion.p
                      key={`${currentSong._id || currentSong.id || 'song'}-${idx}`}
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

                {/* Spacer — lets last line reach center */}
                <div style={{ height: '50vh', flexShrink: 0 }} />
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
