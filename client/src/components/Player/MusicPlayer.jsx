import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useMusic } from '../../context/MusicContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { LyricsIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, ShuffleIcon, VolumeIcon } from '../icons/Icons.jsx';
import { getSongThumbnail } from '../../services/songNormalizer.js';

export default function MusicPlayer() {
  const { 
    currentSong, audioState, isPlaying, playbackError, togglePlay, retryPlayback, playNext, playPrev, 
    progress, volume, isMuted, setVolume, toggleMute, seek, currentTime, actualDuration,
    isShuffled, setIsShuffled, showLyrics, toggleLyrics, initYouTubePlayerContainer
  } = useMusic();
  const { theme } = useTheme();
  const hasInitRef = useRef(false);

  // Initialize YouTube IFrame Player DOM container ONCE (off-screen hidden player)
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    initYouTubePlayerContainer('youtube-player-iframe');
  }, []);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const totalDurationSeconds = actualDuration || (typeof currentSong?.duration === 'number' ? currentSong.duration : 210);

  // Status Banner Message
  const renderStatusBanner = () => {
    if (playbackError) {
      return (
        <div className="absolute top-0 left-0 right-0 bg-amber-600/90 text-white text-[11px] font-medium text-center py-0.5 tracking-wider z-20 flex items-center justify-center gap-3 px-4">
          <span>{playbackError}</span>
          {audioState === 'error' && (
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={retryPlayback}
                className="underline font-bold text-white hover:text-amber-200"
              >
                Retry
              </button>
              <span>•</span>
              <button 
                type="button"
                onClick={playNext}
                className="underline font-bold text-white hover:text-amber-200"
              >
                Next Song
              </button>
            </div>
          )}
        </div>
      );
    }

    if (audioState === 'loading') {
      return (
        <div className="absolute top-0 left-0 right-0 bg-indigo-600/90 text-white text-[11px] font-medium text-center py-0.5 tracking-wider uppercase animate-pulse z-20">
          Loading Music...
        </div>
      );
    }

    if (audioState === 'buffering') {
      return (
        <div className="absolute top-0 left-0 right-0 bg-indigo-600/90 text-white text-[11px] font-medium text-center py-0.5 tracking-wider uppercase animate-pulse z-20">
          Buffering Audio...
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Hidden Persistent YouTube Player Container for Background Audio */}
      <div className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50 overflow-hidden">
        <div id="youtube-player-iframe" className="w-full h-full" />
      </div>

      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: currentSong ? 0 : 100, opacity: currentSong ? 1 : 0 }}
          exit={{ y: 100, opacity: 0 }}
          className={`fixed bottom-0 left-0 right-0 z-50 p-4 ${!currentSong ? 'pointer-events-none' : ''}`}
        >
          <div className="glass-panel max-w-6xl mx-auto rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
            
            {/* Status / Buffering / Error Banner */}
            {renderStatusBanner()}

            {/* Song & Artist Info */}
            <div className="flex items-center gap-4 w-full md:w-1/3 mt-2 md:mt-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-lg shadow-black/50 relative">
                <img 
                  src={getSongThumbnail(currentSong)} 
                  alt={currentSong?.title || "Song Cover"} 
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
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-white truncate text-glow">{currentSong?.title || 'No Song Selected'}</h4>
                <p className="text-sm text-gray-300 font-medium truncate">{currentSong?.artist || 'Select a song to start playback'}</p>
              </div>
            </div>

            {/* Central Controls & Progress Bar */}
            <div className="flex flex-col items-center w-full md:w-1/3 gap-2">
              <div className="flex items-center gap-6">
                <button 
                  type="button"
                  onClick={() => setIsShuffled(!isShuffled)} 
                  className="transition-transform hover:scale-110"
                  title={isShuffled ? "Shuffle Enabled" : "Enable Shuffle"}
                >
                  <div style={{ color: isShuffled ? theme.accent : undefined }}>
                    <ShuffleIcon active={isShuffled} className="w-5 h-5" />
                  </div>
                </button>
                <button type="button" onClick={playPrev} className="text-gray-300 hover:text-white transition-colors">
                  <PrevIcon className="w-6 h-6" />
                </button>
                <button 
                  type="button"
                  onClick={togglePlay}
                  disabled={Boolean(currentSong?.isPlayable === false)}
                  className={`w-12 h-12 text-white rounded-full flex items-center justify-center transition-transform ${
                    currentSong?.isPlayable === false ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                  }`}
                  style={{ 
                    backgroundColor: theme.primary,
                    boxShadow: `0 4px 15px ${theme.glow}`
                  }}
                  title={currentSong?.isPlayable === false ? "PLAY DISABLED" : (isPlaying ? "Pause" : "Play")}
                >
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
                <button type="button" onClick={playNext} className="text-gray-300 hover:text-white transition-colors">
                  <NextIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center gap-2 w-full max-w-md text-xs text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <div 
                  className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer relative overflow-hidden group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    seek((x / rect.width) * 100);
                  }}
                >
                  <motion.div 
                    className="absolute top-0 left-0 h-full"
                    style={{ 
                      width: `${progress}%`,
                      background: `linear-gradient(to right, ${theme.primary}, ${theme.accent})`
                    }}
                  />
                </div>
                <span>{formatTime(totalDurationSeconds)}</span>
              </div>
            </div>

            {/* Lyrics Toggle & Volume Controls */}
            <div className="hidden md:flex items-center justify-end gap-4 w-1/3">
              <button 
                type="button"
                onClick={toggleLyrics}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 border shadow-sm ${
                  showLyrics 
                    ? 'bg-purple-600 text-white border-purple-400 shadow-purple-500/50 ring-2 ring-purple-400/50' 
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                }`}
                title="Toggle Ambient Background Lyrics"
              >
                <LyricsIcon className={`w-4 h-4 ${showLyrics ? 'text-white animate-pulse' : 'text-purple-300'}`} />
                <span>Lyrics</span>
              </button>

              <div className="flex items-center gap-2">
                <button type="button" onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                  <VolumeIcon muted={isMuted || volume === 0} className="w-5 h-5" />
                </button>
                <input 
                  type="range" 
                  min="0" max="1" step="0.01" 
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 bg-white/10 h-1 rounded-full cursor-pointer"
                  style={{ accentColor: theme.primary }}
                />
              </div>
            </div>
            
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
