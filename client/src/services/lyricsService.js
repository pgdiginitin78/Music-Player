/**
 * client/src/services/lyricsService.js
 *
 * Frontend lyrics service.
 * All lyrics requests go through the Express backend (/api/lyrics).
 * No direct browser → lyrics.ovh requests.
 */

/* ── Label names that are invalid as artist values ──────── */
const BLOCKED_ARTISTS = new Set([
  't-series', 'tseries', 'sony music india', 'zee music company', 'saregama music',
  'tips official', 'eros now music', 'yrf', 'dharmatic entertainment',
  'universal music india', 'warner music india', 'junglee music',
  'speed records', 'desi music factory', 'vyrl originals',
]);

function isBlockedArtist(name = '') {
  return BLOCKED_ARTISTS.has(name.toLowerCase().trim());
}

/* ── Title / artist cleaning (mirrors server logic) ─────── */
const TITLE_PREFIX_RE = /^(full\s*(video|audio|song|lyric[s]?)|official\s*(video|audio|song|lyric[s]?|music\s*video)|lyric[s]?\s*(video|song)?|audio\s*(song|video)?|video\s*song|music\s*video|lyrical\s*(video)?)\s*[:\-|]?\s*/gi;

export function cleanTitle(raw = '') {
  return raw
    .replace(TITLE_PREFIX_RE, '')
    .replace(/\s*[|\-]\s*(official\s*(video|audio|song)|full\s*(video|audio|song)|lyric[s]?\s*(video)?|4[kK]|hd|t[-\s]?series|sony music|zee music|saregama)\s*$/gi, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

export function cleanArtist(raw = '') {
  return raw
    .replace(/\s*[,&]\s*.+$/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

/**
 * Parse a YouTube title + artist into usable { songName, artist }.
 * Priority: metadata artist → pipe-extracted artist → empty
 */
export function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);
  const songName = cleanTitle(parts[0] || rawTitle);

  // Use metadata artist if it's valid
  const metaArtist = cleanArtist(rawArtist);
  if (metaArtist && metaArtist.length >= 3 && !isBlockedArtist(metaArtist)) {
    return { songName, artist: metaArtist };
  }

  // Try pipe parts for known artist name patterns
  const knownPatterns = [
    /arijit/i, /jubin/i, /badshah/i, /shreya/i, /udit/i, /sonu nigam/i,
    /sunidhi/i, /armaan/i, /atif/i, /anuv/i, /vishal/i, /pritam/i,
    /a\.r\. rahman/i, /ar rahman/i, /shankar/i, /amit trivedi/i,
  ];

  for (let i = 1; i < parts.length; i++) {
    if (knownPatterns.some((re) => re.test(parts[i])) && !isBlockedArtist(parts[i])) {
      return { songName, artist: parts[i].split(',')[0].trim() };
    }
  }

  // Last resort: last non-label part
  for (let i = parts.length - 1; i >= 1; i--) {
    const c = parts[i].split(',')[0].trim();
    if (!isBlockedArtist(c) && c.length >= 3) {
      return { songName, artist: c };
    }
  }

  return { songName, artist: '' };
}

/* ── API call to backend ─────────────────────────────────── */
/**
 * Fetch lyrics via Express backend.
 * Sends raw title + artist — server handles all parsing/fallbacks.
 */
async function fetchFromBackend(artist, title, signal) {
  const params = new URLSearchParams();
  if (artist) params.set('artist', artist);
  if (title)  params.set('title',  title);
  const res = await fetch(`/api/lyrics?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Main export ─────────────────────────────────────────── */
/**
 * Fetch lyrics for a song object.
 * Sends RAW title + artist to backend — server does all smart parsing.
 *
 * @param {{ title: string, artist: string }} song
 * @param {AbortSignal} [signal]
 * @returns {Promise<string[] | null>}
 */
export async function fetchLyrics(song, signal) {
  if (!song) return null;

  // Send raw values — backend tries every combination
  const rawTitle  = (song.title  || '').trim();
  const rawArtist = (song.artist || '').trim();

  if (!rawTitle && !rawArtist) return null;

  const data = await fetchFromBackend(rawArtist, rawTitle, signal);

  if (data.found && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
    return data.lyrics;
  }
  return null;
}
