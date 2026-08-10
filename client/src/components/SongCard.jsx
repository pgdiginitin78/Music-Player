import { motion } from 'framer-motion';
import { useMusic } from '../context/MusicContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { PlayIcon, PauseIcon } from './icons/Icons.jsx';

export default function SongCard({ song, playlist }) {
  const { currentSong, isPlaying, playSong, togglePlay } = useMusic();
  const { theme } = useTheme();
  
  const songId = song.youtubeVideoId || song.id || song._id;
  const currentId = currentSong?.youtubeVideoId || currentSong?.id || currentSong?._id;
  const isActive = currentId === songId;

  const handlePlay = (e) => {
    e.stopPropagation();
    if (isActive) {
      togglePlay();
    } else {
      playSong(song, playlist);
    }
  };

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
          src={song.coverImage || "/images/default-album.webp"} 
          alt={song.title || "Song Cover"}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/images/default-album.webp";
          }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${isActive || 'opacity-0 group-hover:opacity-100'}`}>
          <button 
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

        {/* YouTube Badge */}
        <span className="absolute top-2 left-2 bg-red-950/80 text-red-300 backdrop-blur-md text-[10px] px-2 py-0.5 rounded-full font-medium border border-red-500/30">
          YouTube
        </span>
      </div>

      <div>
        <h3 className="font-semibold text-base text-white truncate text-glow">{song.title}</h3>
        <p className="text-gray-300 text-sm truncate font-medium">{song.artist}</p>
        {song.album && <p className="text-gray-500 text-xs truncate mt-0.5">{song.album}</p>}
      </div>
    </motion.div>
  );
}
