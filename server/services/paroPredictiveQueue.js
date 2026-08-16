import { searchSongs } from './providers/youtubeProvider.js';

const userQueueCache = new Map();

/**
 * PARO Predictive Queue Service
 * Pre-ranks and pre-fetches upcoming 5-10 songs for current user context in background.
 */
export async function getOrPredictQueue(userId, currentSong, mode = 'for-you') {
  const cacheKey = `paro:user:${userId}:queue:${mode}`;
  const now = Date.now();

  const cached = userQueueCache.get(cacheKey);
  if (cached && (now - cached.timestamp < 120_000)) {
    return cached.songs;
  }

  // Pre-fetch candidate pool from YouTube provider
  let categorySlug = 'for-you';
  if (mode === 'trending') categorySlug = 'trending-hindi';
  if (mode === 'new') categorySlug = 'latest-hindi';

  try {
    const result = await searchSongs({ category: categorySlug, limit: 20 });
    const songs = result.songs || [];

    userQueueCache.set(cacheKey, {
      timestamp: now,
      songs,
    });

    return songs;
  } catch (err) {
    console.warn('[PREDICTIVE QUEUE PREFETCH WARN]', err.message);
    return [];
  }
}

export function clearPredictiveQueue(userId) {
  for (const key of userQueueCache.keys()) {
    if (key.startsWith(`paro:user:${userId}`)) {
      userQueueCache.delete(key);
    }
  }
}
