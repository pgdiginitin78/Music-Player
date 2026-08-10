import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Category from '../models/Category.js';
import Song from '../models/Song.js';

dotenv.config();

const categories = [
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

const seedDB = async () => {
  try {
    await connectDB();

    console.log('Clearing existing categories & fake songs...');
    await Category.deleteMany();
    await Song.deleteMany();

    console.log('Inserting official Hindi music categories...');
    await Category.insertMany(categories);

    console.log('Database seeded successfully with legal Hindi categories!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedDB();
