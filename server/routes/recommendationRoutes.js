import { Router } from 'express';
import userContextMiddleware from '../middleware/userContext.js';
import { invokePulseMindAI } from '../services/pulseMindBridge.js';
import { searchSongs } from '../services/providers/youtubeProvider.js';
import { forYouService } from '../services/forYouService.js';

const router = Router();
router.use(userContextMiddleware);

// Helper to fetch base catalog from YouTube engine
async function fetchCatalogForMode(mode) {
  let categorySlug = 'for-you';
  if (mode === 'trending') categorySlug = 'trending-hindi';
  if (mode === 'new') categorySlug = 'latest-hindi';

  const result = await searchSongs({ category: categorySlug, limit: 50 });
  return result.songs || [];
}

/**
 * GET /api/recommendations/for-you
 */
router.get('/for-you', async (req, res) => {
  try {
    const { userId, deviceId } = req.userContext;
    const catalog = await fetchCatalogForMode('for-you');
    const playEvents = forYouService.playLogs || [];
    const likedIds = req.query.likedIds ? req.query.likedIds.split(',') : [];

    const pulseResponse = await invokePulseMindAI({
      request_type: 'recommendation',
      user_id: userId,
      device_id: deviceId,
      catalog,
      liked_song_ids: likedIds,
      play_events: playEvents,
      mode: 'for-you',
      top_n: 25,
    });

    return res.status(200).json({
      success: true,
      algorithm: 'PulseMind AI',
      mode: 'for-you',
      generatedAt: new Date().toISOString(),
      songs: pulseResponse.songs || catalog.slice(0, 25),
    });
  } catch (err) {
    console.error('[RECOMMENDATIONS FOR-YOU ERROR]', err.message);
    return res.status(500).json({
      success: false,
      algorithm: 'PulseMind AI',
      songs: [],
      error: 'Unable to generate recommendations',
    });
  }
});

/**
 * GET /api/recommendations/trending
 */
router.get('/trending', async (req, res) => {
  try {
    const { userId, deviceId } = req.userContext;
    const catalog = await fetchCatalogForMode('trending');
    const playEvents = forYouService.playLogs || [];

    const pulseResponse = await invokePulseMindAI({
      request_type: 'recommendation',
      user_id: userId,
      device_id: deviceId,
      catalog,
      liked_song_ids: [],
      play_events: playEvents,
      mode: 'trending',
      top_n: 25,
    });

    return res.status(200).json({
      success: true,
      algorithm: 'PulseMind AI',
      mode: 'trending',
      generatedAt: new Date().toISOString(),
      songs: pulseResponse.songs || catalog.slice(0, 25),
    });
  } catch (err) {
    console.error('[RECOMMENDATIONS TRENDING ERROR]', err.message);
    return res.status(500).json({
      success: false,
      algorithm: 'PulseMind AI',
      songs: [],
      error: 'Unable to generate trending recommendations',
    });
  }
});

/**
 * GET /api/recommendations/new
 */
router.get('/new', async (req, res) => {
  try {
    const { userId, deviceId } = req.userContext;
    const catalog = await fetchCatalogForMode('new');
    const playEvents = forYouService.playLogs || [];

    const pulseResponse = await invokePulseMindAI({
      request_type: 'recommendation',
      user_id: userId,
      device_id: deviceId,
      catalog,
      liked_song_ids: [],
      play_events: playEvents,
      mode: 'new',
      top_n: 25,
    });

    return res.status(200).json({
      success: true,
      algorithm: 'PulseMind AI',
      mode: 'new',
      generatedAt: new Date().toISOString(),
      songs: pulseResponse.songs || catalog.slice(0, 25),
    });
  } catch (err) {
    console.error('[RECOMMENDATIONS NEW ERROR]', err.message);
    return res.status(500).json({
      success: false,
      algorithm: 'PulseMind AI',
      songs: [],
      error: 'Unable to generate new release recommendations',
    });
  }
});

export default router;
