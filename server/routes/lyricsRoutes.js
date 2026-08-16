import { Router } from 'express';
import { findLyrics } from '../services/lyricsService.js';

const router = Router();
const ROUTE_TIMEOUT_MS = 10000;

function withRouteTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ found: false, lyrics: null, reason: 'timeout' }), ms);
    }),
  ]);
}

router.get('/', async (req, res) => {
  const { artist = '', title = '' } = req.query;

  if (!title && !artist) {
    return res.status(400).json({
      success: false,
      found: false,
      title: title || '',
      artist: artist || '',
      lyrics: null,
      message: 'Song title or artist is required.',
    });
  }

  try {
    const result = await withRouteTimeout(findLyrics(artist, title), ROUTE_TIMEOUT_MS);

    if (result.found && Array.isArray(result.lyrics) && result.lyrics.length > 0) {
      return res.status(200).json({
        success: true,
        found: true,
        title: result.title || title,
        artist: result.artist || artist,
        lyrics: result.lyrics,
        source: result.source || 'provider',
      });
    }

    if (result.reason === 'timeout' || result.reason === 'provider_error') {
      return res.status(200).json({
        success: false,
        found: false,
        title: result.title || title,
        artist: result.artist || artist,
        lyrics: null,
        message: 'Unable to retrieve lyrics',
      });
    }

    // Lyrics simply unavailable / not found
    return res.status(200).json({
      success: true,
      found: false,
      title: result.title || title,
      artist: result.artist || artist,
      lyrics: null,
    });
  } catch (err) {
    console.error('[LYRICS ROUTE ERROR]', err.message);
    return res.status(500).json({
      success: false,
      found: false,
      title: title || '',
      artist: artist || '',
      lyrics: null,
      message: 'Unable to retrieve lyrics',
    });
  }
});

export default router;