import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import youtubePlayer, { YTState } from '../services/youtubePlayer';

const MusicContext = createContext();

export const useMusic = () => useContext(MusicContext);

/**
 * Audio State Machine States:
 * 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error'
 */
export const MusicProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [audioState, setAudioState] = useState('idle');
  const [playbackError, setPlaybackError] = useState(null);
  const [volume, setVolume] = useState(1.0); // 0.0 to 1.0
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  const timerRef = useRef(null);
  const skipTimerRef = useRef(null);
  const currentSongRef = useRef(null);
  const queueRef = useRef([]);
  const isShuffledRef = useRef(false);
  const audioStateRef = useRef('idle');

  // Keep refs in sync with state
  currentSongRef.current = currentSong;
  queueRef.current = queue;
  isShuffledRef.current = isShuffled;
  audioStateRef.current = audioState;

  const getSongId = (song) => song?.youtubeSongId || song?.id || song?._id;

  // Clear timers
  const clearIntervalTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []); // stable — no deps

  const clearSkipTimer = useCallback(() => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
  }, []); // stable — no deps

  // Synchronize progress & current time from YouTube Player
  // STABLE: reads currentSong from ref, not from closure state
  const startProgressTracking = useCallback(() => {
    clearIntervalTimer();
    timerRef.current = setInterval(() => {
      if (youtubePlayer) {
        const curTime = youtubePlayer.getCurrentTime() || 0;
        // Read duration from player first, then fall back to ref
        const dur = youtubePlayer.getDuration() || currentSongRef.current?.duration || 0;

        setCurrentTime(curTime);
        if (dur > 0) {
          setActualDuration(dur);
          setProgress((curTime / dur) * 100);
        }
      }
    }, 250);
  }, [clearIntervalTimer]); // stable — does not depend on currentSong state

  // STABLE playNext — reads queue/state from refs, not closures
  // Forward-declared so handleYTStateChange can reference it
  const playNextRef = useRef(null);

  // Handle YouTube player state changes — STABLE callback
  const handleYTStateChange = useCallback((ytState) => {
    console.log('[MUSIC CONTEXT] YouTube Player state:', ytState);
    setAutoplayBlocked(false);

    switch (ytState) {
      case YTState.PLAYING:
        setAudioState('playing');
        setPlaybackError(null);
        startProgressTracking();
        break;

      case YTState.PAUSED:
        setAudioState('paused');
        clearIntervalTimer();
        break;

      case YTState.BUFFERING:
        setAudioState('buffering');
        startProgressTracking();
        break;

      case YTState.ENDED:
        setAudioState('ended');
        clearIntervalTimer();
        // Use ref to avoid stale closure
        if (playNextRef.current) playNextRef.current();
        break;

      case YTState.UNSTARTED:
        setAudioState('idle');
        break;

      default:
        break;
    }
  }, [startProgressTracking, clearIntervalTimer]); // stable — startProgressTracking & clearIntervalTimer are stable

  // Handle YouTube errors — STABLE callback
  const handleYTError = useCallback((errorCode) => {
    console.error('[MUSIC CONTEXT] Song Error Code:', errorCode);
    clearIntervalTimer();
    setAudioState('error');

    let errorMessage = 'Playback error occurred.';
    switch (errorCode) {
      case 2:
        errorMessage = 'Invalid Song ID.';
        break;
      case 5:
        errorMessage = 'HTML5 player error.';
        break;
      case 100:
        errorMessage = 'Song not found or removed.';
        break;
      case 101:
      case 150:
        errorMessage = 'This song cannot be played here (embedding disabled).';
        break;
      case 153:
        errorMessage = 'Unable to initialize playback.';
        break;
      default:
        errorMessage = `Song playback error (${errorCode}).`;
        break;
    }

    setPlaybackError(errorMessage);

    // Auto-skip unavailable song after 1.5s delay — use ref to avoid stale closure
    clearSkipTimer();
    skipTimerRef.current = setTimeout(() => {
      console.log('[MUSIC CONTEXT] Auto-skipping unavailable Song...');
      if (playNextRef.current) playNextRef.current();
    }, 1500);
  }, [clearIntervalTimer, clearSkipTimer]); // stable

  /**
   * Initialize YouTube IFrame Player container — called ONCE on mount.
   * STABLE: does NOT depend on currentSong, volume, or any changing state.
   * The player is created once; songs are loaded via loadVideoById().
   */
  const initYouTubePlayerContainer = useCallback(async (containerId) => {
    try {
      await youtubePlayer.initPlayer(containerId, '', {
        onStateChange: handleYTStateChange,
        onError: handleYTError,
      });
      // Apply initial volume after init
      if (youtubePlayer.isReady) {
        youtubePlayer.setVolume(100); // default full volume
      }
    } catch (err) {
      console.warn('[MUSIC CONTEXT] Player init notice:', err.message);
    }
  }, [handleYTStateChange, handleYTError]); // stable — handleYTStateChange & handleYTError are stable

  // Volume & Mute synchronizer — runs on volume/mute changes only, does NOT reinitialize player
  useEffect(() => {
    if (youtubePlayer && youtubePlayer.isReady) {
      if (isMuted) {
        youtubePlayer.mute();
      } else {
        youtubePlayer.unMute();
        youtubePlayer.setVolume(volume * 100);
      }
    }
  }, [volume, isMuted]);

  /**
   * Play Song Routine
   */
  const playSong = useCallback(async (song, playlist = null, isNavigatingHistory = false) => {
    if (!song) return;

    const targetId = getSongId(song);
    const currentId = getSongId(currentSongRef.current);

    // If clicking currently loaded song: toggle play/pause
    if (currentId === targetId && currentSongRef.current) {
      const state = audioStateRef.current;
      if (state === 'playing') {
        youtubePlayer.pauseSong();
      } else {
        try {
          youtubePlayer.playSong();
        } catch (err) {
          console.error('[MUSIC CONTEXT] Play error:', err);
          setAudioState('error');
          setPlaybackError('Playback blocked or failed.');
        }
      }
      return;
    }

    // Record history
    if (currentSongRef.current && !isNavigatingHistory) {
      setHistory((prev) => [...prev, currentSongRef.current]);
    }

    if (playlist && Array.isArray(playlist) && playlist.length > 0) {
      const playable = playlist.filter((s) => s.isPlayable !== false);
      setQueue(playable.length > 0 ? playable : playlist);
    }

    setCurrentSong(song);
    setCurrentTime(0);
    setProgress(0);
    setActualDuration(song.duration || 0);
    setPlaybackError(null);
    setAudioState('loading');
    clearSkipTimer();

    const SongId = song.youtubeSongId || song.id;
    if (SongId) {
      try {
        youtubePlayer.loadSongById(SongId);
        youtubePlayer.playSong();
      } catch (err) {
        console.error('[MUSIC CONTEXT] Load Song failed:', err);
        setAudioState('error');
        setPlaybackError('Failed to load Song.');
      }
    }
  }, [clearSkipTimer]); // stable — reads mutable state via refs

  const togglePlay = useCallback(() => {
    if (!currentSongRef.current) return;

    if (audioStateRef.current === 'playing') {
      youtubePlayer.pauseSong();
    } else {
      try {
        youtubePlayer.playSong();
      } catch (err) {
        console.error('[MUSIC CONTEXT] Toggle play error:', err);
      }
    }
  }, []); // stable

  const retryPlayback = useCallback(() => {
    if (currentSongRef.current) {
      playSong(currentSongRef.current);
    }
  }, [playSong]);

  const playNext = useCallback(() => {
    const queue = queueRef.current;
    if (!queue || queue.length === 0) return;

    let nextSong = null;
    const currentId = getSongId(currentSongRef.current);
    const currentIndex = queue.findIndex((s) => getSongId(s) === currentId);

    if (isShuffledRef.current && queue.length > 1) {
      const candidates = queue.filter((s) => getSongId(s) !== currentId);
      nextSong = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      const nextIndex = (currentIndex + 1) % queue.length;
      nextSong = queue[nextIndex];
    }

    if (nextSong) {
      playSong(nextSong);
    }
  }, [playSong]); // stable — reads queue & isShuffled from refs

  // Keep playNextRef up to date so handleYTStateChange/handleYTError can call it
  playNextRef.current = playNext;

  const playPrev = useCallback(() => {
    setHistory((prev) => {
      if (prev.length > 0) {
        const prevSong = prev[prev.length - 1];
        playSong(prevSong, null, true);
        return prev.slice(0, -1);
      } else {
        const queue = queueRef.current;
        if (queue.length > 0) {
          const currentId = getSongId(currentSongRef.current);
          const currentIndex = queue.findIndex((s) => getSongId(s) === currentId);
          const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
          playSong(queue[prevIndex], null, true);
        }
        return prev;
      }
    });
  }, [playSong]);

  const seek = useCallback((percentage) => {
    const totalDur = youtubePlayer.getDuration() || currentSongRef.current?.duration || 0;
    if (totalDur > 0) {
      const seekSeconds = (percentage / 100) * totalDur;
      youtubePlayer.seekTo(seekSeconds, true);
      setProgress(percentage);
      setCurrentTime(seekSeconds);
    }
  }, []); // stable

  const setVolumeLevel = useCallback((val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
  }, []); // stable

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []); // stable

  return (
    <MusicContext.Provider
      value={{
        currentSong,
        queue,
        history,
        audioState,
        isPlaying: audioState === 'playing',
        isBuffering: audioState === 'loading' || audioState === 'buffering',
        playbackError,
        volume,
        isMuted,
        progress,
        currentTime,
        actualDuration,
        isShuffled,
        autoplayBlocked,
        showLyrics,
        setShowLyrics,
        toggleLyrics: () => setShowLyrics(prev => !prev),
        playSong,
        togglePlay,
        retryPlayback,
        playNext,
        playPrev,
        setVolume: setVolumeLevel,
        toggleMute,
        seek,
        setIsShuffled,
        setQueue,
        initYouTubePlayerContainer,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};
