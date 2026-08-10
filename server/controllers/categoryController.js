import Category from '../models/Category.js';
import mongoose from 'mongoose';

const staticCategories = [
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

export const getCategories = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const categories = await Category.find();
      if (categories && categories.length > 0) {
        return res.status(200).json(categories);
      }
    }
    return res.status(200).json(staticCategories);
  } catch (error) {
    console.warn('[CATEGORIES FETCH WARN]', error.message);
    return res.status(200).json(staticCategories);
  }
};

export const getCategoryBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    if (mongoose.connection.readyState === 1) {
      const category = await Category.findOne({ slug });
      if (category) return res.status(200).json(category);
    }
    const found = staticCategories.find(c => c.slug === slug);
    if (found) return res.status(200).json(found);
    res.status(404).json({ error: 'NOT_FOUND', message: 'Category not found' });
  } catch (error) {
    console.warn('[CATEGORY BY SLUG WARN]', error.message);
    const found = staticCategories.find(c => c.slug === req.params.slug);
    if (found) return res.status(200).json(found);
    res.status(500).json({ error: 'CATEGORY_FETCH_FAILED', message: 'Error fetching category' });
  }
};
