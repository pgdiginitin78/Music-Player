import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, MusicIcon } from '../icons/Icons.jsx';

const lyricsDatabase = {
  "kesariya": [
    "Mujhko itna bataaye koi",
    "Kaise tujhse dil na lagaaye koi",
    "Rabba ne tujhko banaane mein",
    "Kardi hain husn ki khaali tijoriyaan",
    "Kajre ki siyaahi se likhi",
    "Hain tu ne jaane kitno ki kismat goriyaan",
    "Kesariya tera ishq hai piya",
    "Rang jaaun jo main haath lagaun",
    "Din beete saara teri fikr mein",
    "Rain saari teri khair manaun"
  ],
  "apna bana le": [
    "Tu mera koi na hoke bhi kuch laage",
    "Tu mera koi na hoke bhi kuch laage",
    "Kiya re jo bhi toone mujhe ab na hoshein",
    "Apna bana le piya",
    "Apna bana le piya",
    "Apna bana le mujhe",
    "Apna bana le piya",
    "Dil ke nagar mein shehar tu basa le",
    "Apna bana le piya"
  ],
  "husn": [
    "Dekho dekho kaise baatein ye banaaye",
    "Jhoothi meethi baaton se ye mujhko behlaaye",
    "Par husn tera jaisa dekha nahi kahin",
    "Aankhon mein leke pyaar ki ravaiya",
    "Ab to tu aaja mere paas chaliya",
    "Husn tera jaisa dekha nahi kahin",
    "Baaton baaton mein din ye dhal jaaye"
  ],
  "chaleya": [
    "Ishq mein dil bana hai chaliya",
    "Tere piche piche chaliya",
    "Dil mera ab tera ho chaliya",
    "Haan tu hi hai bas tu hi hai sohniye",
    "Mera har pal ab tera ho chaliya",
    "Sajda main tera karun har ghadi",
    "Ishq mein dil bana hai chaliya"
  ],
  "o maahi": [
    "O maahi mera o maahi",
    "O maahi mera o maahi",
    "Tere bina jeena bhi kya jeena",
    "Dil ne tujhko hi pukaara hai",
    "O maahi mera o maahi",
    "Tu hi to mera ek sahaara hai"
  ],
  "tum hi ho": [
    "Hum tere bin ab reh nahi sakte",
    "Tere bina kya wajood mera",
    "Tujhse juda agar ho jaayenge",
    "To khud se hi ho jaayenge judaa",
    "Kyunki tum hi ho",
    "Ab tum hi ho",
    "Zindagi ab tum hi ho",
    "Chain bhi, mera dard bhi",
    "Meri aashiqui ab tum hi ho"
  ],
  "pehle bhi main": [
    "Pehle bhi main tumse mila hoon",
    "Pehli dafa hi milke lagaa",
    "Aankhon se aankhein milaati ho jab tum",
    "Dhadkan ye meri rukti hai zaroor",
    "Pehle bhi main tumse mila hoon"
  ]
};

export default function LyricsModal({ isOpen, onClose, currentSong, currentTime, theme }) {
  if (!isOpen || !currentSong) return null;

  const getLyrics = () => {
    const titleLower = (currentSong.title || '').toLowerCase();
    for (const [key, lines] of Object.entries(lyricsDatabase)) {
      if (titleLower.includes(key)) {
        return lines;
      }
    }

    return [
      `♪ ${currentSong.title || 'Song'} ♪`,
      `Artist: ${currentSong.artist || 'Unknown Artist'}`,
      "",
      "Sun raha hai na tu",
      "Dil ki har ek sadaa",
      "Teri yaadon mein beete raatein",
      "Kyun door tu mujhse chala",
      "",
      "Har lamha tera hi khayaal hai",
      "Dil ka har ek taar tera sawal hai",
      "Sangeet ki is dhun mein khoye hum",
      "Pyaar ki is raah mein chalte hum",
      "",
      "♪ Instrumental Solo ♪",
      "",
      "Aankhon mein tera hi chehra rahe",
      "Dhadkan mein teri hi saansien rahe",
      "Hamesha tu mere paas rahe"
    ];
  };

  const lines = getLyrics();
  const activeLineIndex = Math.floor((currentTime / (currentSong.duration || 240)) * lines.length);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-gray-900/90 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden text-center max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-3 text-left min-w-0">
              <img 
                src={currentSong.coverImage || "/images/default-album.webp"} 
                alt={currentSong.title} 
                className="w-12 h-12 rounded-xl object-cover shadow-md flex-shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-bold text-white text-base md:text-lg truncate">{currentSong.title}</h3>
                <p className="text-xs md:text-sm text-gray-300 truncate">{currentSong.artist}</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
              title="Close Lyrics"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Lyrics Content Container */}
          <div className="flex-1 overflow-y-auto py-8 px-2 space-y-4 scrollbar-thin scrollbar-thumb-white/20">
            <div className="text-xs uppercase tracking-widest text-purple-400 font-semibold mb-6 flex items-center justify-center gap-2">
              <MusicIcon className="w-4 h-4 animate-bounce" />
              Lyrics & Karaoke Sync
            </div>

            {lines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              if (!line) return <div key={idx} className="h-4" />;
              
              return (
                <motion.p
                  key={idx}
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    opacity: isActive ? 1 : 0.45
                  }}
                  transition={{ duration: 0.3 }}
                  className={`text-base md:text-xl font-medium transition-all ${
                    isActive 
                      ? 'text-white font-bold text-glow' 
                      : 'text-gray-300'
                  }`}
                  style={{
                    color: isActive ? theme?.accent || '#c4b5fd' : undefined
                  }}
                >
                  {line}
                </motion.p>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-white/10 text-xs text-gray-400 flex items-center justify-between">
            <span>Synchronized Lyrics</span>
            <span className="font-mono text-purple-300">Audio Engine</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
