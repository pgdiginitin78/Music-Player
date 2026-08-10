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

  const getSongId = (song) => song?.youtubeSongId || song?.id || song?._id;

  // Clear timers
  const clearIntervalTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearSkipTimer = () => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
  };

  // Synchronize progress & current time from YouTube Player
  const startProgressTracking = useCallback(() => {
    clearIntervalTimer();
    timerRef.current = setInterval(() => {
      if (youtubePlayer) {
        const curTime = youtubePlayer.getCurrentTime() || 0;
        const dur = youtubePlayer.getDuration() || currentSong?.duration || 0;
        
        setCurrentTime(curTime);
        if (dur > 0) {
          setActualDuration(dur);
          setProgress((curTime / dur) * 100);
        }
      }
    }, 250);
  }, [currentSong]);

  // Handle YouTube player state changes
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
        playNext();
        break;

      case YTState.UNSTARTED:
        setAudioState('idle');
        break;

      default:
        break;
    }
  }, [startProgressTracking]);

  // Handle YouTube errors
  const handleYTError = useCallback((errorCode) => {
    console.error('[MUSIC CONTEXT] Song Error Code:', errorCode);
    clearIntervalTimer();
    setAudioState('error');

    let errorMessage = "Playback error occurred.";
    switch (errorCode) {
      case 2:
        errorMessage = "Invalid Song Song ID.";
        break;
      case 5:
        errorMessage = "HTML5 Song player error.";
        break;
      case 100:
        errorMessage = "Song not found or removed.";
        break;
      case 101:
      case 150:
        errorMessage = "This Song cannot be played here (embedding disabled).";
        break;
      case 153:
        errorMessage = "Unable to initialize Song playback.";
        break;
      default:
        errorMessage = `Song playback error (${errorCode}).`;
        break;
    }

    setPlaybackError(errorMessage);

    // Auto-skip unavailable Song after 1.5s delay
    clearSkipTimer();
    skipTimerRef.current = setTimeout(() => {
      console.log('[MUSIC CONTEXT] Auto-skipping unavailable Song...');
      playNext();
    }, 1500);
  }, []);

  // Initialize YouTube IFrame Player instance
  const initYouTubePlayerContainer = useCallback(async (containerId) => {
    try {
      const SongId = currentSong?.youtubeSongId || currentSong?.id || '';
      await youtubePlayer.initPlayer(containerId, SongId, {
        onStateChange: handleYTStateChange,
        onError: handleYTError
      });
      if (volume > 0) {
        youtubePlayer.setVolume(volume * 100);
      }
    } catch (err) {
      console.warn('[MUSIC CONTEXT] Player init notice:', err.message);
    }
  }, [handleYTStateChange, handleYTError, volume, currentSong]);

  // Volume & Mute synchronizer
  useEffect(() => {
    if (youtubePlayer) {
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
  const playSong = async (song, playlist = null, isNavigatingHistory = false) => {
    if (!song) return;

    const targetId = getSongId(song);
    const currentId = getSongId(currentSong);

    // If clicking currently loaded song: toggle play/pause
    if (currentId === targetId && currentSong) {
      if (audioState === 'playing') {
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
    if (currentSong && !isNavigatingHistory) {
      setHistory((prev) => [...prev, currentSong]);
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
  };

  const togglePlay = () => {
    if (!currentSong) return;

    if (audioState === 'playing') {
      youtubePlayer.pauseSong();
    } else {
      try {
        youtubePlayer.playSong();
      } catch (err) {
        console.error('[MUSIC CONTEXT] Toggle play error:', err);
      }
    }
  };

  const retryPlayback = () => {
    if (currentSong) {
      playSong(currentSong);
    }
  };

  const playNext = () => {
    if (!queue || queue.length === 0) return;

    let nextSong = null;
    const currentId = getSongId(currentSong);
    const currentIndex = queue.findIndex((s) => getSongId(s) === currentId);

    if (isShuffled && queue.length > 1) {
      const candidates = queue.filter((s) => getSongId(s) !== currentId);
      nextSong = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      const nextIndex = (currentIndex + 1) % queue.length;
      nextSong = queue[nextIndex];
    }

    if (nextSong) {
      playSong(nextSong);
    }
  };

  const playPrev = () => {
    if (history.length > 0) {
      const prevSong = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      playSong(prevSong, null, true);
    } else if (queue.length > 0) {
      const currentId = getSongId(currentSong);
      const currentIndex = queue.findIndex((s) => getSongId(s) === currentId);
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      playSong(queue[prevIndex], null, true);
    }
  };

  const seek = (percentage) => {
    const totalDur = youtubePlayer.getDuration() || actualDuration || currentSong?.duration || 0;
    if (totalDur > 0) {
      const seekSeconds = (percentage / 100) * totalDur;
      youtubePlayer.seekTo(seekSeconds, true);
      setProgress(percentage);
      setCurrentTime(seekSeconds);
    }
  };

  const setVolumeLevel = (val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

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
        initYouTubePlayerContainer
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};
