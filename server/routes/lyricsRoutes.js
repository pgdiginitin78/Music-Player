/**
 * server/routes/lyricsRoutes.js
 *
 * GET /api/lyrics?artist=...&title=...
 *
 * Returns a normalised JSON response — always the same shape.
 */

import { Router } from 'express';
import { findLyrics } from '../services/lyricsService.js';

const router = Router();

router.get('/', async (req, res) => {
  const { artist = '', title = '' } = req.query;

  if (!title) {
    return res.status(400).json({
      found: false,
      lyrics: [],
      source: 'lyrics.ovh',
      reason: 'missing_title',
    });
  }

  try {
    const result = await findLyrics(artist, title);

    return res.status(200).json({
      found: result.found,
      artist: result.artist || artist,
      title: result.title || title,
      lyrics: result.lyrics || [],
      source: result.source || 'lyrics.ovh',
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (err) {
    console.error('[LYRICS ROUTE ERROR]', err.message);
    return res.status(200).json({
      found: false,
      lyrics: [],
      source: 'lyrics.ovh',
      reason: 'provider_error',
    });
  }
});

export default router;
