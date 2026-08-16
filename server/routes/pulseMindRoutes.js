import { Router } from 'express';
import userContextMiddleware from '../middleware/userContext.js';
import { invokePulseMindAI } from '../services/pulseMindBridge.js';
import { searchSongs } from '../services/providers/youtubeProvider.js';
import LikedSong from '../models/LikedSong.js';
import PulseEvent from '../models/PulseEvent.js';
import UserPulseProfile from '../models/UserPulseProfile.js';
import mongoose from 'mongoose';

const router = Router();
router.use(userContextMiddleware);

// Helper to fetch base catalog from YouTube engine
async function fetchCatalogForMode(mode = 'for-you') {
  let categorySlug = 'for-you';
  if (mode === 'trending') categorySlug = 'trending-hindi';
  if (mode === 'new') categorySlug = 'latest-hindi';

  const result = await searchSongs({ category: categorySlug, limit: 50 });
  return result.songs || [];
}

/**
 * POST /api/pulsemind/chat
 * Conversational AI Chat Endpoint
 */
router.post('/chat', async (req, res) => {
  try {
    const { userId, deviceId } = req.userContext;
    const { message, playerState, sessionContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid chat message is required' });
    }

    const catalog = await fetchCatalogForMode('for-you');

    // Fetch user liked songs
    let likedSongIds = [];
    if (mongoose.connection.readyState === 1) {
      const likes = await LikedSong.find({ userId }).select('youtubeVideoId').lean();
      likedSongIds = likes.map((l) => l.youtubeVideoId);
    }

    // Fetch user play events
    let playEvents = [];
    if (mongoose.connection.readyState === 1) {
      playEvents = await PulseEvent.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    }

    // Fetch user taste profile
    let userProfile = null;
    if (mongoose.connection.readyState === 1) {
      userProfile = await UserPulseProfile.findOne({ userId }).lean();
    }

    const response = await invokePulseMindAI({
      request_type: 'chat',
      user_id: userId,
      device_id: deviceId,
      message,
      player_state: playerState || null,
      catalog,
      user_profile: userProfile,
      liked_song_ids: likedSongIds,
      play_events: playEvents,
      session_context: sessionContext || null,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error('[PULSEMIND CHAT ERROR]', err.message);
    return res.status(500).json({
      success: false,
      algorithm: 'PulseMind AI',
      reply: "I've got you 🎧 Let's start something chill.",
      actions: [{ type: 'PLAY_RECOMMENDED_QUEUE', mode: 'for-you', params: {} }],
      songs: [],
    });
  }
});

/**
 * POST /api/pulsemind/events
 * Record listening events (plays, skips, duration, completion, replays)
 */
router.post('/events', async (req, res) => {
  try {
    const { userId, deviceId } = req.userContext;
    const {
      youtubeVideoId,
      title,
      artist,
      category,
      eventType = 'play',
      durationPlayedSec = 0,
      totalSongDurationSec = 210,
      skipped = false,
    } = req.body;

    if (!youtubeVideoId) {
      return res.status(400).json({ success: false, error: 'youtubeVideoId is required' });
    }

    const total = Math.max(1, totalSongDurationSec);
    const ratio = Math.min(1.0, durationPlayedSec / total);

    if (mongoose.connection.readyState === 1) {
      await PulseEvent.create({
        userId,
        deviceId,
        youtubeVideoId,
        title: title || '',
        artist: artist || '',
        category: category || '',
        eventType,
        durationPlayedSec,
        totalSongDurationSec: total,
        completionRatio: ratio,
        skipped,
        timeOfDay: getTimeOfDay(),
        dayOfWeek: new Date().getDay(),
      });
    }

    return res.status(200).json({ success: true, message: 'Pulse event recorded' });
  } catch (err) {
    console.error('[PULSEMIND EVENT LOG ERROR]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/pulsemind/recommendations
 * Modes: for-you, trending, new-releases, because-you-listened, next-up
 */
router.get('/recommendations', async (req, res) => {
  try {
    const { userId, deviceId } = req.userContext;
    const mode = req.query.mode || 'for-you';
    const debug = req.query.debug === 'true';
    const topN = parseInt(req.query.topN || '25', 10);

    const catalog = await fetchCatalogForMode(mode);

    let likedSongIds = [];
    let playEvents = [];
    let userProfile = null;

    if (mongoose.connection.readyState === 1) {
      const likes = await LikedSong.find({ userId }).select('youtubeVideoId').lean();
      likedSongIds = likes.map((l) => l.youtubeVideoId);

      playEvents = await PulseEvent.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
      userProfile = await UserPulseProfile.findOne({ userId }).lean();
    }

    const response = await invokePulseMindAI({
      request_type: 'recommendation',
      user_id: userId,
      device_id: deviceId,
      catalog,
      user_profile: userProfile,
      liked_song_ids: likedSongIds,
      play_events: playEvents,
      mode,
      top_n: topN,
      debug,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error('[PULSEMIND RECOMMENDATIONS ERROR]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/pulsemind/profile
 * Returns authenticated user taste profile & vectors
 */
router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.userContext;
    let profile = null;

    if (mongoose.connection.readyState === 1) {
      profile = await UserPulseProfile.findOne({ userId }).lean();
    }

    return res.status(200).json({
      success: true,
      userId,
      profile: profile || {
        userId,
        artistAffinities: {},
        genreAffinities: {},
        preferredEnergy: 0.65,
        preferredTempo: 110,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/pulsemind/user-data
 * Privacy history reset endpoint
 */
router.delete('/user-data', async (req, res) => {
  try {
    const { userId } = req.userContext;

    if (mongoose.connection.readyState === 1) {
      await PulseEvent.deleteMany({ userId });
      await UserPulseProfile.deleteOne({ userId });
    }

    return res.status(200).json({
      success: true,
      message: 'User AI memory & listening history deleted successfully',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export default router;
