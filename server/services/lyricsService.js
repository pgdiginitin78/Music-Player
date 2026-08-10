/**
 * server/services/lyricsService.js
 *
 * Handles:
 * - YouTube title parsing & cleaning
 * - Artist normalisation
 * - Search attempt ordering (primary → fallbacks)
 * - In-memory cache (found: long TTL, not_found: short TTL, errors: not cached)
 */

import { getLyrics } from './lyrics/lyricsProvider.js';

/* ── Cache ─────────────────────────────────────────────────── */
// Map<cacheKey, { result, expiresAt }>
const cache = new Map();
const TTL_FOUND_MS = 30 * 60 * 1000;      // 30 minutes for found lyrics
const TTL_NOT_FOUND_MS = 5 * 60 * 1000;   // 5 minutes for not-found (avoids hammering)

function cacheKey(artist, title) {
  return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim().replace(/\s+/g, ' ')}`;
}

function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.result;
}

function toCache(key, result) {
  // Only cache found or not_found — NOT provider errors or timeouts
  if (result.found) {
    cache.set(key, { result, expiresAt: Date.now() + TTL_FOUND_MS });
  } else if (result.reason === 'not_found') {
    cache.set(key, { result, expiresAt: Date.now() + TTL_NOT_FOUND_MS });
  }
  // provider_error / timeout → not cached
}

/* ── Label/channel names to reject as artist ─────────────── */
const BLOCKED_ARTISTS = new Set([
  't-series', 'tseries', 'sony music india', 'zee music company', 'saregama music',
  'tips official', 'eros now music', 'yrf', 'dharmatic entertainment',
  'universal music india', 'warner music india', 'junglee music',
  'speed records', 'desi music factory', 'vyrl originals',
]);

function isBlockedArtist(name) {
  if (!name) return true;
  return BLOCKED_ARTISTS.has(name.toLowerCase().trim());
}

/* ── Song title cleaning ─────────────────────────────────── */
// Prefixes to strip (at beginning of title only)
const TITLE_PREFIX_RE = /^(full\s*(video|audio|song|lyric[s]?|hd|4k)|official\s*(video|audio|song|lyric[s]?|music\s*video)|lyric[s]?\s*(video|song)?|audio\s*(song|video)?|video\s*song|music\s*video|song|lyrical\s*(video)?)\s*[:\-|]?\s*/gi;

// Suffixes / inline tags to remove
const TITLE_SUFFIX_RE = /\s*[\|\-]\s*(official\s*(video|audio|song|music\s*video|lyric[s]?)|full\s*(video|audio|song)|lyric[s]?\s*(video|song)?|4[kK]|hd|1080p|720p|remaster(ed)?|music\s*video|video\s*song|t[-\s]?series|sony music|zee music|saregama|tips official|eros now)\s*$/gi;

export function cleanTitle(raw = '') {
  return raw
    .replace(TITLE_PREFIX_RE, '')
    .replace(TITLE_SUFFIX_RE, '')
    .replace(/\s*\(.*?\)/g, '')   // (feat. X), (2024), (4K Video), etc.
    .replace(/\s*\[.*?\]/g, '')   // [Official], [4K], etc.
    .trim();
}

export function cleanArtist(raw = '') {
  // Take only first artist from comma/ampersand list
  return raw
    .replace(/\s*[,&]\s*.+$/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

/* ── YouTube title parser ─────────────────────────────────── */
/**
 * Given a raw YouTube video title and a raw artist string,
 * return { songName, artist } suitable for lyrics lookup.
 *
 * Priority:
 * 1. Use provided artist if it is valid (not a blocked label, not too short)
 * 2. Extract artist from pipe-separated title parts
 * 3. Fall back to empty string (will skip artist-only lookup)
 */
export function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);

  // Song name = cleaned first part
  const songName = cleanTitle(parts[0] || rawTitle);

  // Artist from metadata
  const metaArtist = cleanArtist(rawArtist);

  // If metadata artist is usable, use it
  if (metaArtist && metaArtist.length >= 3 && !isBlockedArtist(metaArtist)) {
    return { songName, artist: metaArtist };
  }

  // Try to extract artist from remaining pipe-separated parts
  // Skip movie/album names (usually short proper nouns); prefer ones that look like artist names
  const knownArtistPatterns = [
    /arijit/i, /jubin/i, /badshah/i, /shreya/i, /udit/i, /kumar sanu/i,
    /lata/i, /kishore/i, /mohd rafi/i, /sonu nigam/i, /sunidhi/i,
    /armaan/i, /atif/i, /anuv/i, /vishal/i, /shekhar/i, /shankar/i,
    /pritam/i, /amit trivedi/i, /a\.r\. rahman/i, /ar rahman/i,
  ];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const isLikelyArtist = knownArtistPatterns.some((re) => re.test(part));
    if (isLikelyArtist && !isBlockedArtist(part)) {
      // Extract first name from comma list
      const artist = part.split(',')[0].trim();
      return { songName, artist };
    }
  }

  // Last resort: try second-to-last non-label part
  if (parts.length >= 3) {
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts[i].split(',')[0].trim();
      if (!isBlockedArtist(candidate) && candidate.length >= 3) {
        return { songName, artist: candidate };
      }
    }
  }

  return { songName, artist: '' };
}

/* ── Main service function ───────────────────────────────── */
/**
 * Find lyrics using many strategies to handle messy YouTube metadata.
 * Tries all combinations: cleaned, swapped, pipe-split, etc.
 *
 * @param {string} rawArtist  - May contain the real song name (DB often swaps them)
 * @param {string} rawTitle   - May contain the real artist name
 * @returns {{ found, artist, title, lyrics[], source, reason? }}
 */
export async function findLyrics(rawArtist, rawTitle) {
  const { songName, artist } = parseYouTubeTitle(rawTitle, rawArtist);

  // Helper: split a string on pipe and clean each part
  const pipeParts = (s) => (s || '').split('|').map((p) => cleanTitle(p.trim())).filter(Boolean);

  // Build ALL search attempt pairs — dedup below
  const rawAttempts = [];

  // ── Primary: parsed result ──
  if (artist && songName) rawAttempts.push([artist, songName]);
  if (songName)           rawAttempts.push(['', songName]);

  // ── Cleaned raw title + raw artist ──
  const ct = cleanTitle(rawTitle);
  const ca = cleanArtist(rawArtist);
  if (ca && ct) rawAttempts.push([ca, ct]);
  if (ct)       rawAttempts.push(['', ct]);

  // ── SWAP: use rawArtist as the song title (common in Hindi YouTube data) ──
  // e.g. title="Anuv Jain X Lost Stories", artist="Arz Kiya Hai | Coke Studio Bharat"
  // → try title="Arz Kiya Hai", artist="Anuv Jain"
  const artistPipes = pipeParts(rawArtist); // ["Arz Kiya Hai", "Coke Studio Bharat"]
  const titlePipes  = pipeParts(rawTitle);  // ["Anuv Jain X Lost Stories"]

  // Each pipe section of the artist field as the song title
  for (const ap of artistPipes) {
    rawAttempts.push([artist || titlePipes[0] || '', ap]);
    rawAttempts.push(['', ap]);
    // Pair with each pipe section of title field as the artist
    for (const tp of titlePipes) {
      rawAttempts.push([tp, ap]);
    }
  }

  // Each pipe section of title as song title paired with each artist pipe part
  for (const tp of titlePipes) {
    for (const ap of artistPipes) {
      rawAttempts.push([ap, tp]);
    }
    rawAttempts.push(['', tp]);
  }

  // ── Deduplicate ──
  const seen = new Set();
  const attempts = rawAttempts.filter(([a, t]) => {
    if (!t) return false;
    const k = `${a.toLowerCase()}::${t.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log(`[LYRICS] Trying ${attempts.length} search combinations for rawTitle="${rawTitle}" rawArtist="${rawArtist}"`);

  for (const [a, t] of attempts) {
    const key = cacheKey(a, t);
    const cached = fromCache(key);

    if (cached) {
      console.log('[LYRICS] Cache hit for', key);
      return cached;
    }

    const result = await getLyrics(a, t);

    if (result.found) {
      toCache(key, result);
      return result;
    }

    if (result.reason === 'not_found') {
      toCache(key, result);
      // Continue trying next combination
      continue;
    }

    // Hard error (provider_error / timeout) — bail out
    if (result.reason === 'provider_error' || result.reason === 'timeout') {
      return { found: false, lyrics: [], source: 'lyrics.ovh', reason: result.reason };
    }
  }

  return {
    found: false,
    artist,
    title: songName,
    lyrics: [],
    source: 'lyrics.ovh',
    reason: 'not_found',
  };
}

