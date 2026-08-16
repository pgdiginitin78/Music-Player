import { Router } from 'express';
import userContextMiddleware from '../middleware/userContext.js';
import { parseFastIntent } from '../services/paroFastRouter.js';
import { findBestSongMatch } from '../services/songMatcher.js';
import { searchSongs } from '../services/providers/youtubeProvider.js';
import { invokePulseMindAI } from '../services/pulseMindBridge.js';
import { getOrPredictQueue } from '../services/paroPredictiveQueue.js';
import LikedSong from '../models/LikedSong.js';
import PulseEvent from '../models/PulseEvent.js';
import UserPulseProfile from '../models/UserPulseProfile.js';
import mongoose from 'mongoose';

const router = Router();
router.use(userContextMiddleware);

/**
 * POST /api/paro/command
 * PARO Low-Latency Fast Command Endpoint
 */
router.post('/command', async (req, res) => {
  const t0 = Date.now();
  try {
    const { userId, deviceId } = req.userContext;
    const { message, playerState, requestId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid command string required' });
    }

    // 1. Evaluate Fast Intent Router (< 5ms)
    const fastResult = parseFastIntent(message, playerState);

    // Level 1: Instant Player Action (Pause, Resume, Skip, Previous)
    if (fastResult.level === 1) {
      return res.status(200).json({
        success: true,
        level: 1,
        requestId,
        latencyMs: Date.now() - t0,
        reply: fastResult.reply,
        actions: [{ type: fastResult.action.toUpperCase() + '_SONG' }],
        songs: [],
      });
    }

    // Level 2 Priority 1: Exact Song Request Matcher ("Play Ehsass", "Play Kesariya")
    if (fastResult.level === 2 && fastResult.intent === 'PLAY_EXACT_SONG') {
      const searchRes = await searchSongs({ query: fastResult.query, limit: 15 });
      const rawResults = searchRes.songs || [];

      const matchResult = findBestSongMatch({
        requestedTitle: fastResult.songTitle,
        requestedArtist: fastResult.songArtist,
        results: rawResults,
      });

      if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
        console.log(`[PARO MATCH TRACE] Requested: "${fastResult.songTitle}" | Matched: "${matchResult.matchedTitle || 'NONE'}" | MatchType: ${matchResult.matchType} | Confidence: ${matchResult.confidence}`);
      }

      let activeMatch = matchResult;
      if ((!activeMatch.song || activeMatch.confidence < 0.40) && rawResults.length > 0) {
        const fallbackSong = rawResults.find(s => !s.duration || s.duration >= 80) || rawResults[0];
        activeMatch = {
          song: fallbackSong,
          confidence: 0.50,
          matchType: 'BEST_AVAILABLE_MATCH',
          playbackSource: (fallbackSong.duration && fallbackSong.duration >= 80) ? 'FULL_TRACK' : 'PREVIEW',
        };
      }

      if (activeMatch.song) {
        // Requested song wins! Place as songs[0] so it immediately plays.
        const remainingSongs = rawResults.filter(
          (s) => (s.youtubeVideoId || s.id) !== (activeMatch.song.youtubeVideoId || activeMatch.song.id)
        );
        const orderedSongs = [activeMatch.song, ...remainingSongs];

        return res.status(200).json({
          success: true,
          level: 2,
          requestId,
          latencyMs: Date.now() - t0,
          reply: `Sure, playing ${activeMatch.song.title}.`,
          intent: fastResult,
          match: {
            songTitle: activeMatch.song.title,
            artist: activeMatch.song.artist,
            trackId: activeMatch.song.youtubeVideoId || activeMatch.song.id,
            duration: activeMatch.song.duration,
            playbackSource: activeMatch.playbackSource || 'FULL_TRACK',
            confidence: activeMatch.confidence,
            matchType: activeMatch.matchType,
          },
          actions: [
            {
              type: 'PLAY_RECOMMENDED_QUEUE',
              mode: 'exact-song',
              params: { songTitle: fastResult.songTitle },
            },
          ],
          songs: orderedSongs,
        });
      } else {
        // Zero results returned from provider
        return res.status(200).json({
          success: true,
          level: 2,
          requestId,
          latencyMs: Date.now() - t0,
          reply: `I couldn't find ${fastResult.songTitle}.`,
          intent: fastResult,
          match: {
            confidence: 0,
            matchType: 'NO_MATCH',
          },
          actions: [],
          songs: [],
        });
      }
    }

    // Level 2 General Intents: Fast Music Intent (< 150ms)
    if (fastResult.level === 2) {
      const predictedSongs = await getOrPredictQueue(userId, playerState?.currentSong, fastResult.mode);

      return res.status(200).json({
        success: true,
        level: 2,
        requestId,
        latencyMs: Date.now() - t0,
        reply: fastResult.reply,
        intent: fastResult,
        actions: [
          {
            type: 'PLAY_RECOMMENDED_QUEUE',
            mode: fastResult.mode,
            params: {
              language: fastResult.language,
              mood: fastResult.mood,
              artist: fastResult.artist,
            },
          },
        ],
        songs: predictedSongs.slice(0, 20),
      });
    }

    // Level 3: Complex Conversation (Python PulseMind AI Engine)
    let likedSongIds = [];
    let playEvents = [];
    let userProfile = null;

    if (mongoose.connection.readyState === 1) {
      const [likes, events, profile] = await Promise.all([
        LikedSong.find({ userId }).select('youtubeVideoId').lean(),
        PulseEvent.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
        UserPulseProfile.findOne({ userId }).lean(),
      ]);
      likedSongIds = (likes || []).map((l) => l.youtubeVideoId);
      playEvents = events || [];
      userProfile = profile;
    }

    const predictedCatalog = await getOrPredictQueue(userId, playerState?.currentSong, 'for-you');

    const deepResult = await invokePulseMindAI({
      request_type: 'chat',
      user_id: userId,
      device_id: deviceId,
      message,
      player_state: playerState || null,
      catalog: predictedCatalog,
      user_profile: userProfile,
      liked_song_ids: likedSongIds,
      play_events: playEvents,
    });

    return res.status(200).json({
      ...deepResult,
      level: 3,
      requestId,
      latencyMs: Date.now() - t0,
    });
  } catch (err) {
    console.error('[PARO COMMAND ROUTER ERROR]', err.message);
    return res.status(500).json({
      success: false,
      reply: "I've got you. Starting music for you.",
      actions: [{ type: 'PLAY_RECOMMENDED_QUEUE', mode: 'for-you', params: {} }],
      songs: [],
    });
  }
});

/**
 * GET /api/paro/predictive-queue
 */
router.get('/predictive-queue', async (req, res) => {
  try {
    const { userId } = req.userContext;
    const mode = req.query.mode || 'for-you';
    const songs = await getOrPredictQueue(userId, null, mode);
    return res.status(200).json({ success: true, songs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
