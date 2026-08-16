import { fetchFromOvh } from './lyricsOvhProvider.js';

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