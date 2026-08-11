import { getLyrics } from './lyrics/lyricsProvider.js';

const cache = new Map();
const TTL_FOUND_MS = 30 * 60 * 1000;
const TTL_NOT_FOUND_MS = 5 * 60 * 1000;

const MAX_ATTEMPTS = 6;
const PER_CALL_TIMEOUT_MS = 3000;
const OVERALL_BUDGET_MS = 8000;

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
  if (result.found) {
    cache.set(key, { result, expiresAt: Date.now() + TTL_FOUND_MS });
  } else if (result.reason === 'not_found') {
    cache.set(key, { result, expiresAt: Date.now() + TTL_NOT_FOUND_MS });
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ found: false, lyrics: [], reason: 'timeout' }), ms);
    })
  ]);
}

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

const TITLE_PREFIX_RE = /^(full\s*(video|audio|song|lyric[s]?|hd|4k)|official\s*(video|audio|song|lyric[s]?|music\s*video)|lyric[s]?\s*(video|song)?|audio\s*(song|video)?|video\s*song|music\s*video|song|lyrical\s*(video)?)\s*[:\-|]?\s*/gi;

const TITLE_SUFFIX_RE = /\s*[\|\-]\s*(official\s*(video|audio|song|music\s*video|lyric[s]?)|full\s*(video|audio|song)|lyric[s]?\s*(video|song)?|4[kK]|hd|1080p|720p|remaster(ed)?|music\s*video|video\s*song|t[-\s]?series|sony music|zee music|saregama|tips official|eros now)\s*$/gi;

export function cleanTitle(raw = '') {
  return raw
    .replace(TITLE_PREFIX_RE, '')
    .replace(TITLE_SUFFIX_RE, '')
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

export function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);

  const songName = cleanTitle(parts[0] || rawTitle);
  const metaArtist = cleanArtist(rawArtist);

  if (metaArtist && metaArtist.length >= 3 && !isBlockedArtist(metaArtist)) {
    return { songName, artist: metaArtist };
  }

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
      const artist = part.split(',')[0].trim();
      return { songName, artist };
    }
  }

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

export async function findLyrics(rawArtist, rawTitle) {
  const { songName, artist } = parseYouTubeTitle(rawTitle, rawArtist);

  const pipeParts = (s) => (s || '').split('|').map((p) => cleanTitle(p.trim())).filter(Boolean);

  const rawAttempts = [];

  if (artist && songName) rawAttempts.push([artist, songName]);
  if (songName)           rawAttempts.push(['', songName]);

  const ct = cleanTitle(rawTitle);
  const ca = cleanArtist(rawArtist);
  if (ca && ct) rawAttempts.push([ca, ct]);
  if (ct)       rawAttempts.push(['', ct]);

  const artistPipes = pipeParts(rawArtist);
  const titlePipes  = pipeParts(rawTitle);

  for (const ap of artistPipes) {
    rawAttempts.push([artist || titlePipes[0] || '', ap]);
    rawAttempts.push(['', ap]);
    for (const tp of titlePipes) {
      rawAttempts.push([tp, ap]);
    }
  }

  for (const tp of titlePipes) {
    for (const ap of artistPipes) {
      rawAttempts.push([ap, tp]);
    }
    rawAttempts.push(['', tp]);
  }

  const seen = new Set();
  const attempts = rawAttempts
    .filter(([a, t]) => {
      if (!t) return false;
      const k = `${a.toLowerCase()}::${t.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_ATTEMPTS);

  console.log(`[LYRICS] Trying ${attempts.length} search combinations for rawTitle="${rawTitle}" rawArtist="${rawArtist}"`);

  const startTime = Date.now();

  for (const [a, t] of attempts) {
    if (Date.now() - startTime > OVERALL_BUDGET_MS) {
      console.warn('[LYRICS] Overall time budget exceeded, stopping early');
      break;
    }

    const key = cacheKey(a, t);
    const cached = fromCache(key);

    if (cached) {
      console.log('[LYRICS] Cache hit for', key);
      return cached;
    }

    const result = await withTimeout(getLyrics(a, t), PER_CALL_TIMEOUT_MS);

    if (result.found) {
      toCache(key, result);
      return result;
    }

    if (result.reason === 'not_found') {
      toCache(key, result);
      continue;
    }

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