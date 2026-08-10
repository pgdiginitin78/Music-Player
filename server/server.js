import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import songRoutes from './routes/songs.js';
import categoryRoutes from './routes/categories.js';
import Category from './models/Category.js';
import Song from './models/Song.js';

// Development Global Process Error Handlers
process.on("uncaughtException", error => {
  console.error("[UNCAUGHT EXCEPTION]", error);
});

process.on("unhandledRejection", reason => {
  console.error("[UNHANDLED REJECTION]", reason);
});

dotenv.config();

// Log environment variable configuration status
console.log('[ENV CHECK]', {
  PORT: process.env.PORT || 5000,
  MONGODB_URI_configured: Boolean(process.env.MONGODB_URI),
  YOUTUBE_API_KEY_configured: Boolean(process.env.YOUTUBE_API_KEY),
  MUSIC_PROVIDER: process.env.MUSIC_PROVIDER || 'youtube'
});

const app = express();

// Middleware
app.use(cors({
  origin: "*",
  credentials: false
}));
app.use(express.json());
app.use(express.static('public'));

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
  if (mongoose.connection.readyState !== 1) {
    console.log('Skipping MongoDB sync - running in YouTube Data API provider mode.');
    return;
  }
  try {
    await Category.deleteMany();
    await Category.insertMany(requiredCategories);
    await Song.deleteMany(); // Purge legacy entries
    console.log('Catalog categories synchronized successfully.');
  } catch (err) {
    console.error('Error synchronizing catalog categories:', err.message);
  }
}

// Connect to Database and Sync Categories safely
connectDB().then(() => {
  if (mongoose.connection.readyState === 1) {
    syncCatalog().catch(err => console.error('Catalog sync error:', err.message));
  } else {
    console.log('MongoDB not connected. Live YouTube provider active.');
  }
}).catch(err => {
  console.error('MongoDB connection initialization error:', err.message);
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "ok",
    server: true,
    database: isDbConnected,
    provider: "YouTube Data API v3"
  });
});

// Routes
app.use('/api/songs', songRoutes);
app.use('/api/categories', categoryRoutes);

// Express Global Error Handler
app.use((err, req, res, next) => {
  console.error("[EXPRESS ERROR]", {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: err.stack
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Music playback service failed."
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with YouTube provider engine.`);
});
