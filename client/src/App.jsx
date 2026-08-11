import { AnimatePresence, motion } from 'framer-motion';
import Home from './pages/Home.jsx';
import MusicPlayer from './components/Player/MusicPlayer.jsx';
import SceneBackground from './components/visuals/SceneBackground.jsx';
import BackgroundLyrics from './components/visuals/BackgroundLyrics.jsx';
import { useTheme } from './context/ThemeContext.jsx';

function App() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen pb-28 relative">
      {/* Background Wallpaper Crossfade */}
      <AnimatePresence>
        {theme.wallpaper?.endsWith('.mp4') ? (
          <motion.video
            key={theme.wallpaper}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            src={theme.wallpaper}
            autoPlay
            loop
            muted
            playsInline
            className="fixed inset-0 -z-30 w-full h-full object-cover opacity-60"
          />
        ) : (
          <motion.div
            key={theme.wallpaper}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="fixed inset-0 -z-30 bg-cover bg-center bg-no-repeat opacity-40"
            style={{ backgroundImage: `url(${theme.wallpaper})` }}
          />
        )}
      </AnimatePresence>

      {/* Cinematic Gradient Overlay */}
      <div className={`fixed inset-0 -z-20 bg-gradient-to-br ${theme.gradient} transition-colors duration-1000 opacity-90`} />

      {/* Live Animated Particle Wallpaper */}
      <SceneBackground />

      {/* Synchronized Ambient Background Lyrics Layer */}
      <BackgroundLyrics />

      <main className="container mx-auto px-4 md:px-8 py-8 relative z-10">
        <Home />
      </main>

      <MusicPlayer />
    </div>
  );
}

export default App;
