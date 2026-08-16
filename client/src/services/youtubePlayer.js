/**
 * YouTube IFrame Player API Manager Service
 * Manages YT.Player lifecycle, events, controls, and player state synchronization.
 *
 * IMPORTANT: The player is created ONCE and reused for all songs via loadVideoById().
 * Never call initPlayer() more than once.
 */

export const YTState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

class YouTubePlayerService {
  constructor() {
    this.player = null;
    this.isReady = false;
    this.containerId = null;
    this.listeners = new Set();
    this.apiLoaded = false;
    this.pendingVideoId = null;
    this.currentVideoId = null;
    this._initialized = false; // guard: only create one player instance
    this._initPromise = null;  // reuse the same init promise if called again
  }

  /**
   * Loads YouTube IFrame API script tag ONCE.
   * Subsequent calls immediately resolve if already loaded.
   */
  loadIFrameAPI() {
    if (this.apiLoaded || window.YT) {
      this.apiLoaded = true;
      return Promise.resolve();
    }

    // Deduplicate: if the script tag already exists, wait for it
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      return new Promise((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          this.apiLoaded = true;
          if (import.meta.env.DEV) console.log('[DEBUG] YouTube API loaded');
          if (prev) prev();
          resolve();
        };
      });
    }

    return new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => {
        this.apiLoaded = true;
        if (import.meta.env.DEV) console.log('[DEBUG] YouTube API loaded');
        resolve();
      };

      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => reject(new Error('Failed to load YouTube IFrame API script'));
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    });
  }

  /**
   * Initializes YT.Player in specified DOM element ID — ONCE.
   * If already initialized, returns the existing player immediately.
   */
  async initPlayer(elementId, initialVideoId = '', onEvents = {}) {
    // ── Guard: never create more than one player instance ──
    if (this._initialized && this.player) {
      console.log('[YOUTUBE] Player already initialized — skipping re-init');
      // Re-wire event handlers in case callbacks changed (harmless)
      this._onStateChange = onEvents.onStateChange;
      this._onError = onEvents.onError;
      return this.player;
    }

    // ── Deduplicate concurrent calls ──
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._doInitPlayer(elementId, initialVideoId, onEvents);
    return this._initPromise;
  }

  async _doInitPlayer(elementId, initialVideoId, onEvents) {
    this.containerId = elementId;
    this.currentVideoId = initialVideoId;
    this._onStateChange = onEvents.onStateChange;
    this._onError = onEvents.onError;

    await this.loadIFrameAPI();

    return new Promise((resolve) => {
      const createPlayer = () => {
        if (!window.YT || !window.YT.Player) {
          setTimeout(createPlayer, 100);
          return;
        }

        // Safety: destroy any stale player (only on first real init)
        if (this.player && typeof this.player.destroy === 'function') {
          try {
            this.player.destroy();
          } catch (e) {}
        }

        const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
        if (import.meta.env.DEV) console.log('[DEBUG] Current origin', originUrl);

        const playerOptions = {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 0,       // do NOT autoplay on init — we control this explicitly
            controls: 0,       // hidden (we have our own UI)
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            origin: originUrl,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              this.isReady = true;
              this._initialized = true;
              if (import.meta.env.DEV) console.log('[DEBUG] Player ready');
              
              if (this.pendingVideoId) {
                if (import.meta.env.DEV) console.log('[DEBUG] Video ID loaded');
                this.loadVideoById(this.pendingVideoId);
                this.pendingVideoId = null;
              }
              if (this.pendingPlay) {
                if (import.meta.env.DEV) console.log('[DEBUG] playVideo called');
                this.playVideo();
                this.pendingPlay = false;
              }
              if (onEvents.onReady) onEvents.onReady(event);
              resolve(this.player);
            },
            onStateChange: (event) => {
              // Always use the LATEST handlers (stored as instance props)
              if (import.meta.env.DEV) console.log('[DEBUG] Current player state', event.data);
              if (this._onStateChange) this._onStateChange(event.data);
              this.notifyListeners('stateChange', event.data);
            },
            onError: (event) => {
              if (import.meta.env.DEV) console.log('[DEBUG] Current error code', event.data);
              if (this._onError) this._onError(event.data);
              this.notifyListeners('error', event.data);
            },
          },
        };

        // Only pass videoId if a valid non-empty string is provided
        if (initialVideoId && typeof initialVideoId === 'string' && initialVideoId.trim() !== '') {
          playerOptions.videoId = initialVideoId.trim();
        }

        try {
          this.player = new window.YT.Player(elementId, playerOptions);
          if (import.meta.env.DEV) console.log('[DEBUG] Player created');
        } catch (err) {
          console.warn('[YOUTUBE INIT PLAYER WARN]', err.message);
          resolve(null);
        }
      };

      createPlayer();
    });
  }

  loadVideoById(videoId) {
    if (!videoId || typeof videoId !== 'string' || videoId.trim() === '') return;
    const cleanId = videoId.trim();
    this.currentVideoId = cleanId;

    if (this.isReady && this.player && typeof this.player.loadVideoById === 'function') {
      try {
        if (import.meta.env.DEV) {
          console.log('[DEBUG] Current video ID', cleanId);
          console.log('[DEBUG] Video ID loaded');
        }
        this.player.loadVideoById(cleanId);
      } catch (err) {
        console.error('[YOUTUBE LOAD VIDEO ERROR]', err);
      }
    } else {
      this.pendingVideoId = cleanId;
    }
  }

  // Alias used by MusicContext
  loadSongById(videoId) {
    this.loadVideoById(videoId);
  }

  playVideo() {
    if (this.isReady && this.player && typeof this.player.playVideo === 'function') {
      try {
        if (import.meta.env.DEV) console.log('[DEBUG] playVideo called');
        this.player.playVideo();
      } catch (e) {
        console.error('[YOUTUBE PLAY ERROR]', e);
      }
    } else {
      this.pendingPlay = true;
    }
  }

  // Alias used by MusicContext
  playSong() {
    this.playVideo();
  }

  pauseVideo() {
    if (this.isReady && this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch (e) {
        console.error('[YOUTUBE PAUSE ERROR]', e);
      }
    }
  }

  // Alias used by MusicContext
  pauseSong() {
    this.pauseVideo();
  }

  seekTo(seconds, allowSeekAhead = true) {
    if (this.isReady && this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(seconds, allowSeekAhead);
      } catch (e) {
        console.error('[YOUTUBE SEEK ERROR]', e);
      }
    }
  }

  setVolume(volume) {
    if (this.isReady && this.player && typeof this.player.setVolume === 'function') {
      try {
        this.player.setVolume(Math.max(0, Math.min(100, volume)));
      } catch (e) {
        console.error('[YOUTUBE VOLUME ERROR]', e);
      }
    }
  }

  mute() {
    if (this.isReady && this.player && typeof this.player.mute === 'function') {
      try {
        this.player.mute();
      } catch (e) {
        console.error('[YOUTUBE MUTE ERROR]', e);
      }
    }
  }

  unMute() {
    if (this.isReady && this.player && typeof this.player.unMute === 'function') {
      try {
        this.player.unMute();
      } catch (e) {
        console.error('[YOUTUBE UNMUTE ERROR]', e);
      }
    }
  }

  getCurrentTime() {
    if (this.isReady && this.player && typeof this.player.getCurrentTime === 'function') {
      try {
        return this.player.getCurrentTime() || 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  getDuration() {
    if (this.isReady && this.player && typeof this.player.getDuration === 'function') {
      try {
        return this.player.getDuration() || 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  getPlayerState() {
    if (this.isReady && this.player && typeof this.player.getPlayerState === 'function') {
      try {
        return this.player.getPlayerState();
      } catch (e) {
        return YTState.UNSTARTED;
      }
    }
    return YTState.UNSTARTED;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(type, data) {
    this.listeners.forEach((listener) => {
      try {
        listener(type, data);
      } catch (err) {
        console.error('[YOUTUBE EVENT LISTENER ERROR]', err);
      }
    });
  }

  destroy() {
    if (this.player && typeof this.player.destroy === 'function') {
      try {
        this.player.destroy();
      } catch (e) {}
    }
    this.player = null;
    this.isReady = false;
    this._initialized = false;
    this._initPromise = null;
    this.listeners.clear();
  }
}

export const youtubePlayer = new YouTubePlayerService();
export default youtubePlayer;
