import { fetchFromLrclib } from './lrclibProvider.js';
import { fetchFromOvh } from './lyricsOvhProvider.js';

export async function getLyrics(artist, title) {
  // 1. Try LRCLIB first (large library, plain & synced lyrics, clean output)
  const lrcResult = await fetchFromLrclib(artist, title);
  if (lrcResult.found) {
    return {
      found: true,
      artist,
      title,
      lyrics: lrcResult.lyrics,
      source: 'lrclib',
    };
  }

  // 2. Fallback to Lyrics.ovh
  const ovhResult = await fetchFromOvh(artist, title);
  if (ovhResult.found) {
    return {
      found: true,
      artist,
      title,
      lyrics: ovhResult.lyrics,
      source: 'lyrics.ovh',
    };
  }

  return {
    found: false,
    artist,
    title,
    lyrics: null,
    source: 'none',
    reason: lrcResult.reason || ovhResult.reason || 'not_found',
  };
}