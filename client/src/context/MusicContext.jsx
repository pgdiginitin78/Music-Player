import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import youtubePlayer, { YTState } from "../services/youtubePlayer";
import { getSongThumbnail } from "../services/songNormalizer.js";

const MusicContext = createContext();

export const useMusic = () => useContext(MusicContext);

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS13Plus =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOS13Plus;
}


export const MusicProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [audioState, setAudioState] = useState("idle");
  const [playbackError, setPlaybackError] = useState(null);
  const [volume, setVolume] = useState(1.0); // 0.0 to 1.0
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const playerRef = useRef(null);

  const timerRef = useRef(null);
  const skipTimerRef = useRef(null);
  const currentSongRef = useRef(null);
  const queueRef = useRef([]);
  const isShuffledRef = useRef(false);
  const audioStateRef = useRef("idle");

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
        const dur =
          youtubePlayer.getDuration() || currentSongRef.current?.duration || 0;

        setCurrentTime(curTime);
        if (dur > 0) {
          setActualDuration(dur);
          setProgress((curTime / dur) * 100);

          if (
            "mediaSession" in navigator &&
            typeof navigator.mediaSession.setPositionState === "function"
          ) {
            try {
              navigator.mediaSession.setPositionState({
                duration: dur,
                playbackRate: 1,
                position: Math.min(curTime, dur),
              });
            } catch (err) {
              // Some browsers throw if called with invalid/out-of-range values — safe to ignore
            }
          }
        }
      }
    }, 250);
  }, [clearIntervalTimer]); // stable — does not depend on currentSong state

  // STABLE playNext — reads queue/state from refs, not closures
  // Forward-declared so handleYTStateChange can reference it
  const playNextRef = useRef(null);

  // Handle YouTube player state changes — STABLE callback
  const handleYTStateChange = useCallback(
    (ytState) => {
      if (import.meta.env.DEV)
        console.log("[DEBUG] [MUSIC CONTEXT] YouTube Player state:", ytState);
      setAutoplayBlocked(false);

      switch (ytState) {
        case YTState.PLAYING:
          setAudioState("playing");
          setPlaybackError(null);
          startProgressTracking();
          break;

        case YTState.PAUSED:
          setAudioState("paused");
          clearIntervalTimer();
          break;

        case YTState.BUFFERING:
          setAudioState("buffering");
          startProgressTracking();
          break;

        case YTState.ENDED:
          setAudioState("ended");
          clearIntervalTimer();
          // Use ref to avoid stale closure
          if (playNextRef.current) playNextRef.current();
          break;

        case YTState.UNSTARTED:
          setAudioState("idle");
          break;

        default:
          break;
      }
    },
    [startProgressTracking, clearIntervalTimer],
  ); // stable — startProgressTracking & clearIntervalTimer are stable

  // Handle YouTube errors — STABLE callback
  const handleYTError = useCallback(
    (errorCode) => {
      if (import.meta.env.DEV)
        console.error("[DEBUG] [MUSIC CONTEXT] Song Error Code:", errorCode);
      clearIntervalTimer();
      setAudioState("error");

      let errorMessage = "Playback error occurred.";
      let removeAndSkip = false;

      switch (errorCode) {
        case 2:
          errorMessage = "Invalid Song ID.";
          break;
        case 5:
          errorMessage = "HTML5 player error.";
          break;
        case 100:
          errorMessage = "Song not found or removed.";
          break;
        case 101:
        case 150:
          errorMessage =
            "This song cannot be played here (embedding disabled).";
          removeAndSkip = true;
          break;
        case 153:
          errorMessage = "Unable to initialize playback.";
          break;
        default:
          errorMessage = `Song playback error (${errorCode}).`;
          break;
      }

      setPlaybackError(errorMessage);

      if (removeAndSkip) {
        const currentId = getSongId(currentSongRef.current);
        setQueue((prevQueue) => {
          const newQueue = prevQueue.filter((s) => getSongId(s) !== currentId);
          queueRef.current = newQueue;
          return newQueue;
        });
      }

      // Auto-skip unavailable song after 1.5s delay
      clearSkipTimer();
      skipTimerRef.current = setTimeout(() => {
        if (import.meta.env.DEV)
          console.log(
            "[DEBUG] [MUSIC CONTEXT] Auto-skipping unavailable Song...",
          );
        if (playNextRef.current) playNextRef.current();
      }, 1500);
    },
    [clearIntervalTimer, clearSkipTimer],
  ); // stable

  /**
   * Initialize YouTube IFrame Player container — called ONCE on mount.
   * STABLE: does NOT depend on currentSong, volume, or any changing state.
   * The player is created once; songs are loaded via loadVideoById().
   */
  const initYouTubePlayerContainer = useCallback(
    async (containerId) => {
      try {
        const player = await youtubePlayer.initPlayer(containerId, "", {
          onStateChange: handleYTStateChange,
          onError: handleYTError,
          onReady: () => setPlayerReady(true),
        });
        playerRef.current = player;

        if (youtubePlayer.isReady) {
          setPlayerReady(true);
          youtubePlayer.setVolume(100);
        }
      } catch (err) {
        console.warn("[MUSIC CONTEXT] Player init notice:", err.message);
      }
    },
    [handleYTStateChange, handleYTError],
  ); // stable — handleYTStateChange & handleYTError are stable

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
  const playSong = useCallback(
    async (song, playlist = null, isNavigatingHistory = false) => {
      if (!song) return;

      const targetId = getSongId(song);
      const currentId = getSongId(currentSongRef.current);

      // If clicking currently loaded song: toggle play/pause
      if (currentId === targetId && currentSongRef.current) {
        const state = audioStateRef.current;
        if (state === "playing") {
          youtubePlayer.pauseSong();
        } else {
          try {
            youtubePlayer.playSong();
          } catch (err) {
            console.error("[MUSIC CONTEXT] Play error:", err);
            setAudioState("error");
            setPlaybackError("Playback blocked or failed.");
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
      setAudioState("loading");
      clearSkipTimer();

      const SongId = song.youtubeSongId || song.id;
      if (SongId) {
        try {
          youtubePlayer.loadSongById(SongId);
          youtubePlayer.playSong();
        } catch (err) {
          console.error("[MUSIC CONTEXT] Load Song failed:", err);
          setAudioState("error");
          setPlaybackError("Failed to load Song.");
        }
      }
    },
    [clearSkipTimer],
  ); // stable — reads mutable state via refs

  const togglePlay = useCallback(() => {
    if (!currentSongRef.current) return;

    if (audioStateRef.current === "playing") {
      youtubePlayer.pauseSong();
    } else {
      try {
        youtubePlayer.playSong();
      } catch (err) {
        console.error("[MUSIC CONTEXT] Toggle play error:", err);
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
          const currentIndex = queue.findIndex(
            (s) => getSongId(s) === currentId,
          );
          const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
          playSong(queue[prevIndex], null, true);
        }
        return prev;
      }
    });
  }, [playSong]);

  const seek = useCallback((percentage) => {
    const totalDur =
      youtubePlayer.getDuration() || currentSongRef.current?.duration || 0;
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

  // ── Media Session API: lock-screen / notification playback controls ──────
  // Registers action handlers once. All referenced callbacks (togglePlay,
  // playNext, playPrev, seek) are stable across renders, so this only
  // needs to run on mount.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrev());
    navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        const totalDur =
          youtubePlayer.getDuration() || currentSongRef.current?.duration || 0;
        if (totalDur > 0) {
          const percentage = (details.seekTime / totalDur) * 100;
          seek(percentage);
        }
      }
    });

    return () => {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [togglePlay, playPrev, playNext, seek]);

  // Update lock-screen / notification metadata whenever the current song changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artwork = getSongThumbnail(currentSong);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "Untitled Track",
      artist: currentSong.artist || "Unknown Artist",
      album: currentSong.album || "",
      artwork: artwork
        ? [
            { src: artwork, sizes: "96x96", type: "image/jpeg" },
            { src: artwork, sizes: "256x256", type: "image/jpeg" },
            { src: artwork, sizes: "512x512", type: "image/jpeg" },
          ]
        : [],
    });
  }, [currentSong]);

  // Keep the lock-screen play/pause indicator in sync with actual playback state
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (audioState === "playing") {
      navigator.mediaSession.playbackState = "playing";
    } else if (audioState === "paused" || audioState === "idle") {
      navigator.mediaSession.playbackState = "paused";
    } else {
      navigator.mediaSession.playbackState = "none";
    }
  }, [audioState]);

  const wasPlayingBeforeHiddenRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const iOS = isIOSDevice();
    if (!iOS) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (audioStateRef.current === "playing") {
          wasPlayingBeforeHiddenRef.current = true;
          clearIntervalTimer();
          try {
            youtubePlayer.pauseVideo();
          } catch (err) {
            // no-op — iOS may have already suspended it
          }
          setAudioState("paused");
          setPlaybackError(
            "Background playback isn't supported on iOS Safari. Reopen the app to resume.",
          );
        } else {
          wasPlayingBeforeHiddenRef.current = false;
        }
      } else if (wasPlayingBeforeHiddenRef.current) {
        wasPlayingBeforeHiddenRef.current = false;
        try {
          youtubePlayer.playVideo();
        } catch (err) {
          // no-op — user can press play manually if this fails
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearIntervalTimer]); // clearIntervalTimer is stable

  return (
    <MusicContext.Provider
      value={{
        currentSong,
        queue,
        history,
        audioState,
        isPlaying: audioState === "playing",
        isBuffering: audioState === "loading" || audioState === "buffering",
        playbackError,
        volume,
        isMuted,
        progress,
        currentTime,
        actualDuration,
        isShuffled,
        autoplayBlocked,
        showLyrics,
        playerReady,
        setShowLyrics,
        toggleLyrics: () => setShowLyrics((prev) => !prev),
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
