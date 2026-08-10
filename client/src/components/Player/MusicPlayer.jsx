import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMusic } from '../../context/MusicContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, VolumeIcon } from '../icons/Icons.jsx';

export default function MusicPlayer() {
  const { 
    currentSong, audioState, isPlaying, isBuffering, playbackError, togglePlay, retryPlayback, playNext, playPrev, 
    progress, volume, isMuted, setVolume, toggleMute, seek, currentTime, actualDuration,
    isShuffled, setIsShuffled, initYouTubePlayerContainer
  } = useMusic();
  const { theme } = useTheme();

  const [showVideoContainer, setShowVideoContainer] = useState(true);

  // Initialize YouTube IFrame Player DOM container
  useEffect(() => {
    initYouTubePlayerContainer('youtube-player-iframe');
  }, [initYouTubePlayerContainer]);

  if (!currentSong) {
    return (
      <div className="hidden">
        <div id="youtube-player-iframe" />
      </div>
    );
  }

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const totalDurationSeconds = actualDuration || (typeof currentSong.duration === 'number' ? currentSong.duration : 210);

  // Status Banner Message
  const renderStatusBanner = () => {
    if (playbackError) {
      return (
        <div className="absolute top-0 left-0 right-0 bg-amber-600/90 text-white text-[11px] font-medium text-center py-0.5 tracking-wider z-20 flex items-center justify-center gap-3 px-4">
          <span>{playbackError}</span>
          {audioState === 'error' && (
            <div className="flex gap-2">
              <button 
                onClick={retryPlayback}
                className="underline font-bold text-white hover:text-amber-200"
              >
                Retry
              </button>
              <span>•</span>
              <button 
                onClick={playNext}
                className="underline font-bold text-white hover:text-amber-200"
              >
                Next Video
              </button>
            </div>
          )}
        </div>
      );
    }

    if (audioState === 'loading') {
      return (
        <div className="absolute top-0 left-0 right-0 bg-indigo-600/90 text-white text-[11px] font-medium text-center py-0.5 tracking-wider uppercase animate-pulse z-20">
          Loading YouTube Video...
        </div>
      );
    }

    if (audioState === 'buffering') {
      return (
        <div className="absolute top-0 left-0 right-0 bg-indigo-600/90 text-white text-[11px] font-medium text-center py-0.5 tracking-wider uppercase animate-pulse z-20">
          Buffering YouTube Video...
        </div>
      );
    }

    return null;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4"
      >
        <div className="glass-panel max-w-6xl mx-auto rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
          
          {/* Status / Buffering / Error Banner */}
          {renderStatusBanner()}

          {/* Song & Channel Info */}
          <div className="flex items-center gap-4 w-full md:w-1/3 mt-2 md:mt-0">
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-lg shadow-black/50 relative">
              <img 
                src={currentSong.coverImage || "/images/default-album.webp"} 
                alt={currentSong.title || "Song Cover"} 
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/default-album.webp";
                }}
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-white truncate text-glow">{currentSong.title}</h4>
              <p className="text-sm text-gray-300 font-medium truncate">{currentSong.artist}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border truncate ${
                  currentSong.isPlayable === false 
                    ? 'text-amber-300 bg-amber-950/60 border-amber-500/30' 
                    : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
                }`}>
                  {currentSong.isPlayable === false 
                    ? 'Playback Unavailable' 
                    : 'Official YouTube playback'}
                </span>
                <span className="text-[10px] text-red-400/90 font-mono font-medium">
                  YouTube API
                </span>
              </div>
            </div>
          </div>

          {/* Dedicated Embedded YouTube Viewport Container */}
          <div className="flex-shrink-0 hidden lg:block">
            <div className="w-40 h-24 rounded-lg overflow-hidden border border-white/10 bg-black shadow-md relative">
              <div id="youtube-player-iframe" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Central Controls & Progress Bar */}
          <div className="flex flex-col items-center w-full md:w-1/3 gap-2">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsShuffled(!isShuffled)} 
                className="transition-transform hover:scale-110"
                title={isShuffled ? "Shuffle Enabled" : "Enable Shuffle"}
              >
                <div style={{ color: isShuffled ? theme.accent : undefined }}>
                  <ShuffleIcon active={isShuffled} className="w-5 h-5" />
                </div>
              </button>
              <button onClick={playPrev} className="text-gray-300 hover:text-white transition-colors">
                <PrevIcon className="w-6 h-6" />
              </button>
              <button 
                onClick={togglePlay}
                disabled={Boolean(currentSong.isPlayable === false)}
                className={`w-12 h-12 text-white rounded-full flex items-center justify-center transition-transform ${
                  currentSong.isPlayable === false ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
                style={{ 
                  backgroundColor: theme.primary,
                  boxShadow: `0 4px 15px ${theme.glow}`
                }}
                title={currentSong.isPlayable === false ? "PLAY DISABLED - Playback Unavailable" : (isPlaying ? "Pause" : "Play")}
              >
                {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
              </button>
              <button onClick={playNext} className="text-gray-300 hover:text-white transition-colors">
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

          {/* Volume Controls */}
          <div className="hidden md:flex items-center justify-end gap-2 w-1/3">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
              <VolumeIcon muted={isMuted || volume === 0} className="w-5 h-5" />
            </button>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 bg-white/10 h-1 rounded-full cursor-pointer"
              style={{ accentColor: theme.primary }}
            />
          </div>
          
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
