/**
 * LyricsService
 * Fetches real lyrics from lyrics.ovh (free, no API key needed).
 * Cleans YouTube-style noisy titles before searching.
 */

const cache = new Map(); // { "artist::title" => string[] | null }

/**
 * Strip YouTube video title junk:
 * "Full Video: Akh Lad Jaave | Loveyatri | Aayush Sharma ..." → "Akh Lad Jaave"
 */
function cleanTitle(rawTitle = '') {
  return rawTitle
    // Remove common prefixes like "Full Video:", "Official Video:", "Audio:", etc.
    .replace(/^(full\s*(video|audio|song|lyric[s]?)|official\s*(video|audio|song|lyric[s]?)|lyric[s]?\s*(video|song)?|audio\s*(song)?)\s*[:\-|]?\s*/gi, '')
    // Remove "| Artist Name" style suffixes (pipe-separated extra info)
    .replace(/\s*[|]\s*.+$/g, '')
    // Remove parenthesised info: "(feat. X)", "(2024)", "(4K)", etc.
    .replace(/\s*\(.*?\)/g, '')
    // Remove bracketed info: "[Official]", "[4K]", etc.
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

/**
 * Clean artist field similarly.
 */
function cleanArtist(rawArtist = '') {
  return rawArtist
    .replace(/\s*[|,&]\s*.+$/g, '') // Take only first artist
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

/**
 * Try to extract song + artist from a YouTube title like:
 * "Akh Lad Jaave | Loveyatri | Aayush Sharma | Warina Hussain | Badshah, Jubin Nautiyal"
 * by splitting on | and picking candidates.
 */
function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim());

  let songName = cleanTitle(parts[0] || rawTitle);
  let artist = cleanArtist(rawArtist);

  // If artist is empty/unknown or just "T-" (truncated), try extracting from title parts
  if (!artist || artist === 'Unknown Artist' || artist.length < 3) {
    // Heuristic: last meaningful part is often the artist
    if (parts.length >= 3) {
      artist = parts[parts.length - 1].replace(/\s*,\s*.+$/, '').trim(); // first in comma list
    }
  }

  return { songName, artist };
}

/**
 * Fetch lyrics from lyrics.ovh
 * Returns string[] (one entry per line) or null on failure.
 */
async function fetchFromLyricsOvh(artist, title) {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.lyrics) return null;

    // Split into lines, remove empty runs, trim
    return data.lyrics
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Main export: fetch lyrics for a song object.
 * song = { title, artist, ... }
 * Returns string[] of lyric lines, or null if unavailable.
 */
export async function fetchLyrics(song) {
  if (!song) return null;

  const { songName, artist } = parseYouTubeTitle(song.title, song.artist);
  const cacheKey = `${artist.toLowerCase()}::${songName.toLowerCase()}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  let lines = null;

  // Primary attempt: cleaned artist + cleaned song name
  if (artist && songName) {
    lines = await fetchFromLyricsOvh(artist, songName);
  }

  // Fallback 1: try without artist (some songs are indexed differently)
  if (!lines && songName) {
    lines = await fetchFromLyricsOvh('hindi', songName);
  }

  // Fallback 2: try just title as-is with original artist
  if (!lines && song.title) {
    lines = await fetchFromLyricsOvh(song.artist || '', cleanTitle(song.title));
  }

  // Cache result (even null, to avoid hammering)
  cache.set(cacheKey, lines);
  return lines;
}

export { cleanTitle, cleanArtist, parseYouTubeTitle };
