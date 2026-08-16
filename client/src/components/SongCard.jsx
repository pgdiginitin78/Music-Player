import { motion } from 'framer-motion';
import { useMusic } from '../context/MusicContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { PlayIcon, PauseIcon, HeartIcon } from './icons/Icons.jsx';
import { getSongThumbnail } from '../services/songNormalizer.js';

export default function SongCard({ song, playlist }) {
  const { currentSong, isPlaying, playSong, togglePlay, isSongLiked, toggleLikeSong } = useMusic();
  const { theme } = useTheme();
  
  const songId = song?.youtubeVideoId || song?.id || song?._id;
  const currentId = currentSong?.youtubeVideoId || currentSong?.id || currentSong?._id;
  const isActive = Boolean(songId && currentId && currentId === songId);
  const isLiked = isSongLiked(songId);

  const handlePlay = (e) => {
    e.stopPropagation();
    if (isActive) {
      togglePlay();
    } else {
      playSong(song, playlist);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLikeSong(song);
  };

  const thumbnailSrc = getSongThumbnail(song);

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className={`relative group rounded-xl p-4 transition-all duration-300 cursor-pointer overflow-hidden border backdrop-blur-md ${
        isActive ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10 border-transparent'
      }`}
      style={{
        borderColor: isActive ? theme.primary : 'transparent',
        boxShadow: isActive ? `0 0 20px ${theme.glow}` : 'none'
      }}
      onClick={handlePlay}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
        <img 
          src={thumbnailSrc} 
          alt={song?.title || "Song Cover"}
          onError={(e) => {
            e.currentTarget.onerror = null;
            if (song?.youtubeVideoId && !e.currentTarget.src.includes('hqdefault')) {
              e.currentTarget.src = `https://i.ytimg.com/vi/${song.youtubeVideoId}/hqdefault.jpg`;
            } else {
              e.currentTarget.src = "/images/default-album.webp";
            }
          }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Like/Heart Button */}
        <button
          type="button"
          onClick={handleLike}
          className={`absolute top-2 right-2 z-20 p-2 rounded-full backdrop-blur-md transition-all duration-300 ${
            isLiked
              ? 'bg-rose-500/80 text-white shadow-lg shadow-rose-500/50 scale-110'
              : 'bg-black/40 text-white/70 hover:text-white hover:bg-black/60 opacity-0 group-hover:opacity-100'
          }`}
          title={isLiked ? "Unlike song" : "Like song"}
        >
          <HeartIcon filled={isLiked} className="w-4 h-4" />
        </button>

        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${isActive || 'opacity-0 group-hover:opacity-100'}`}>
          <button 
            type="button"
            className="w-12 h-12 rounded-full text-white flex items-center justify-center transform transition-transform hover:scale-110"
            style={{ 
              backgroundColor: theme.primary,
              boxShadow: `0 4px 15px ${theme.glow}`
            }}
          >
            {isActive && isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
        
        {isActive && isPlaying && (
          <div className="absolute bottom-2 right-2 flex gap-1 items-end h-4">
            <motion.div animate={{ height: ["20%", "80%", "40%", "100%"] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 rounded-t" style={{ backgroundColor: theme.accent }}></motion.div>
            <motion.div animate={{ height: ["60%", "30%", "90%", "20%"] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 rounded-t" style={{ backgroundColor: theme.accent }}></motion.div>
            <motion.div animate={{ height: ["40%", "100%", "50%", "70%"] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 rounded-t" style={{ backgroundColor: theme.accent }}></motion.div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-base text-white truncate text-glow">{song?.title || 'Untitled Track'}</h3>
        <p className="text-gray-300 text-sm truncate font-medium">{song?.artist || 'Unknown Artist'}</p>
        {song?.album && <p className="text-gray-500 text-xs truncate mt-0.5">{song.album}</p>}
      </div>
    </motion.div>
  );
}
