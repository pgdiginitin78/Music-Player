import app from './app.js';
import connectDB from './config/db.js';
import Category from './models/Category.js';
import Song from './models/Song.js';
import mongoose from 'mongoose';

// Process Error Handlers
process.on("uncaughtException", error => {
  console.error("[UNCAUGHT EXCEPTION]", error);
});

process.on("unhandledRejection", reason => {
  console.error("[UNHANDLED REJECTION]", reason);
});

const PORT = process.env.PORT || 5000;

console.log('[LOCAL SERVER STARTUP]', {
  PORT,
  MONGODB_URI_configured: Boolean(process.env.MONGODB_URI),
  YOUTUBE_API_KEY_configured: Boolean(process.env.YOUTUBE_API_KEY)
});

const requiredCategories = [
  { name: 'For You', slug: 'for-you', description: 'Personalized Hindi vocal selections', wallpaper: '/wallpapers/for-you.svg' },
  { name: 'Bollywood Hits', slug: 'bollywood-hits', description: 'Top chart-topping Bollywood vocal hits', wallpaper: '/wallpapers/bollywood-hits.svg' },
  { name: 'Latest Hindi', slug: 'latest-hindi', description: 'Fresh new Hindi releases', wallpaper: '/wallpapers/latest-hindi.svg' },
  { name: 'Trending Hindi', slug: 'trending-hindi', description: 'Viral and trending Hindi tracks', wallpaper: '/wallpapers/trending-hindi.svg' },
  { name: 'Romantic Hindi', slug: 'romantic-hindi', description: 'Melodious romantic songs', wallpaper: '/wallpapers/romantic-hindi.svg' },
  { name: 'Sad Hindi', slug: 'sad-hindi', description: 'Heart-touching melancholic ballads', wallpaper: '/wallpapers/sad-hindi.svg' },
  { name: 'Lo-Fi Hindi', slug: 'lo-fi-hindi', description: 'Relaxing lo-fi Hindi vocals', wallpaper: '/wallpapers/lo-fi-hindi.svg' },
  { name: 'Old Hindi', slug: 'old-hindi', description: 'Golden retro classics & evergreens', wallpaper: '/wallpapers/old-hindi.svg' },
  { name: 'Party Hindi', slug: 'party-hindi', description: 'Upbeat Hindi party bangers', wallpaper: '/wallpapers/party-hindi.svg' },
  { name: 'Workout Hindi', slug: 'workout-hindi', description: 'High energy workout motivation', wallpaper: '/wallpapers/workout-hindi.svg' },
  { name: 'Rain Hindi', slug: 'rain-hindi', description: 'Monsoon mood melodies', wallpaper: '/wallpapers/rain-hindi.svg' },
  { name: 'Acoustic Hindi', slug: 'acoustic-hindi', description: 'Unplugged acoustic vocals', wallpaper: '/wallpapers/acoustic-hindi.svg' },
  { name: 'Indie Hindi', slug: 'indie-hindi', description: 'Independent Hindi singer-songwriters', wallpaper: '/wallpapers/indie-hindi.svg' }
];

async function syncCatalog() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    await Category.deleteMany();
    await Category.insertMany(requiredCategories);
    await Song.deleteMany();
    console.log('Catalog categories synchronized successfully.');
  } catch (err) {
    console.error('Error synchronizing catalog categories:', err.message);
  }
}

connectDB().then(() => {
  if (mongoose.connection.readyState === 1) {
    syncCatalog().catch(err => console.error('Catalog sync error:', err.message));
  } else {
    console.log('MongoDB not connected. Live YouTube provider active.');
  }
}).catch(err => {
  console.error('MongoDB connection initialization error:', err.message);
});

app.listen(PORT, () => {
  console.log(`Local development server running on port ${PORT} with YouTube provider engine.`);
});
