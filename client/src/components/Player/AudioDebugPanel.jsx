import { useState } from 'react';
import { useMusic } from '../../context/MusicContext.jsx';
import { ChevronIcon } from '../icons/Icons.jsx';

export default function AudioDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    currentSong, audioState, currentTime, actualDuration, playbackError, 
    volume, isMuted 
  } = useMusic();

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 font-mono text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/90 text-red-400 border border-red-500/40 px-3 py-1.5 rounded-lg shadow-lg hover:bg-black transition-all flex items-center gap-2"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${audioState === 'playing' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
        <span>YouTube Diagnostics</span>
        <ChevronIcon direction={isOpen ? 'up' : 'down'} className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="mt-2 w-80 bg-gray-950/95 border border-red-500/30 text-gray-200 p-4 rounded-xl shadow-2xl backdrop-blur-md space-y-2 text-[11px] overflow-hidden">
          <div className="font-bold text-red-400 border-b border-white/10 pb-1 flex justify-between">
            <span>Audio Diagnostics</span>
            <span className="uppercase text-amber-400">{audioState}</span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-gray-400">Audio Title:</span>
            <span className="truncate font-semibold">{currentSong?.title || 'None'}</span>

            <span className="text-gray-400">Channel / Artist:</span>
            <span className="truncate">{currentSong?.artist || 'None'}</span>

            <span className="text-gray-400"> Audio ID:</span>
            <span className="truncate font-mono text-red-300">{currentSong?.youtubeVideoId || currentSong?.id || 'None'}</span>

            <span className="text-gray-400">Player State:</span>
            <span className="capitalize font-semibold text-emerald-300">{audioState}</span>

            <span className="text-gray-400">Muted State:</span>
            <span className={isMuted ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              {isMuted ? 'TRUE (MUTED)' : 'FALSE'}
            </span>

            <span className="text-gray-400">Volume (0-1):</span>
            <span className="font-semibold">{volume}</span>

            <span className="text-gray-400">Current Time:</span>
            <span>{currentTime ? currentTime.toFixed(1) + 's' : '0s'}</span>

            <span className="text-gray-400">Total Duration:</span>
            <span>{actualDuration ? actualDuration.toFixed(1) + 's' : '0s'}</span>
          </div>

          {playbackError && (
            <div className="bg-rose-950/80 border border-rose-500/40 text-rose-300 p-2 rounded text-[10px] break-words">
              <strong>Error:</strong> {playbackError}
            </div>
          )}

          <div className="text-[9px] text-gray-500 truncate pt-1 border-t border-white/10">
            Source URL: {currentSong?.youtubeUrl || 'https://youtube.com'}
          </div>
        </div>
      )}
    </div>
  );
}
