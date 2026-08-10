/**
 * lyricsProvider.js
 *
 * Abstract provider layer.
 * Calls lyricsOvhProvider and returns a normalised result object.
 * Architecture allows swapping/adding providers later.
 */

import { fetchFromOvh } from './lyricsOvhProvider.js';

/**
 * @param {string} artist
 * @param {string} title
 * @returns {{ found: boolean, artist: string, title: string, lyrics: string[], source?: string, reason?: string }}
 */
export async function getLyrics(artist, title) {
  const result = await fetchFromOvh(artist, title);

  return {
    found: result.found,
    artist,
    title,
    lyrics: result.lyrics || [],
    source: result.source || 'lyrics.ovh',
    ...(result.reason ? { reason: result.reason } : {}),
  };
}
