/**
 * YouTube IFrame Player API Manager Service
 * Manages YT.Player lifecycle, events, controls, and player state synchronization.
 */

export const YTState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
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
  }

  /**
   * Loads YouTube IFrame API script tag once
   */
  loadIFrameAPI() {
    if (this.apiLoaded || window.YT) {
      this.apiLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => {
        this.apiLoaded = true;
        resolve();
      };

      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = (err) => reject(new Error('Failed to load YouTube IFrame API script'));
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    });
  }

  /**
   * Initializes YT.Player in specified DOM element ID safely
   */
  async initPlayer(elementId, initialVideoId = '', onEvents = {}) {
    this.containerId = elementId;
    this.currentVideoId = initialVideoId;

    await this.loadIFrameAPI();

    return new Promise((resolve) => {
      const createPlayer = () => {
        if (!window.YT || !window.YT.Player) {
          setTimeout(createPlayer, 100);
          return;
        }

        if (this.player && typeof this.player.destroy === 'function') {
          try {
            this.player.destroy();
          } catch (e) {}
        }

        const playerOptions = {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
            playsinline: 1
          },
          events: {
            onReady: (event) => {
              this.isReady = true;
              console.log('[YOUTUBE PLAYER READY]');
              if (this.pendingVideoId) {
                this.loadVideoById(this.pendingVideoId);
                this.pendingVideoId = null;
              }
              if (onEvents.onReady) onEvents.onReady(event);
            },
            onStateChange: (event) => {
              if (onEvents.onStateChange) onEvents.onStateChange(event.data);
              this.notifyListeners('stateChange', event.data);
            },
            onError: (event) => {
              console.error('[YOUTUBE PLAYER ERROR]', event.data);
              if (onEvents.onError) onEvents.onError(event.data);
              this.notifyListeners('error', event.data);
            }
          }
        };

        // Only pass videoId if a valid non-empty string is provided
        if (initialVideoId && typeof initialVideoId === 'string' && initialVideoId.trim() !== '') {
          playerOptions.videoId = initialVideoId.trim();
        }

        try {
          this.player = new window.YT.Player(elementId, playerOptions);
        } catch (err) {
          console.warn('[YOUTUBE INIT PLAYER WARN]', err.message);
        }
        
        resolve(this.player);
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
        this.player.loadVideoById(cleanId);
      } catch (err) {
        console.error('[YOUTUBE LOAD VIDEO ERROR]', err);
      }
    } else {
      this.pendingVideoId = cleanId;
    }
  }

  playVideo() {
    if (this.isReady && this.player && typeof this.player.playVideo === 'function') {
      try {
        this.player.playVideo();
      } catch (e) {
        console.error('[YOUTUBE PLAY ERROR]', e);
      }
    }
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
    this.listeners.clear();
  }
}

export const youtubePlayer = new YouTubePlayerService();
export default youtubePlayer;
