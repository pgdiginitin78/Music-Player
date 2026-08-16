import { getLyrics } from './lyrics/lyricsProvider.js';

const cache = new Map();
const TTL_FOUND_MS = 24 * 60 * 60 * 1000; // 24 hours for found lyrics
const TTL_NOT_FOUND_MS = 15 * 60 * 1000;   // 15 mins for not found

const MAX_ATTEMPTS = 5;
const PER_CALL_TIMEOUT_MS = 6000;
const OVERALL_BUDGET_MS = 12000;

function cacheKey(artist, title) {
  return `${(artist || '').toLowerCase().trim()}::${(title || '').toLowerCase().trim().replace(/\s+/g, ' ')}`;
}

function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
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
      setTimeout(() => resolve({ found: false, lyrics: null, reason: 'timeout' }), ms);
    }),
  ]);
}

const BLOCKED_ARTISTS = new Set([
  't-series', 'tseries', 'series', 't series', 'sony music india', 'zee music company', 'saregama music',
  'tips official', 'eros now music', 'yrf', 'dharmatic entertainment',
  'universal music india', 'warner music india', 'junglee music',
  'speed records', 'desi music factory', 'vyrl originals', 'unknown artist',
  't-series pop chartbusters', 'tips music', 'sony music', 'zee music',
  'official', 'channel', 'records', 'company', 'entertainment', 'music',
]);

function isBlockedArtist(name) {
  if (!name) return true;
  const clean = name.toLowerCase().trim();
  if (clean.length < 2) return true;
  return BLOCKED_ARTISTS.has(clean);
}

const TITLE_PREFIX_RE = /^(full\s*(video|audio|song|lyric[s]?|hd|4k|8k)|official\s*(video|audio|song|lyric[s]?|music\s*video)|lyric[s]?\s*(video|song)?|audio\s*(song|video)?|video\s*song|music\s*video|song|lyrical\s*(video)?)\s*[:\-|]?\s*/gi;
const TITLE_SUFFIX_RE = /\s*[\|\-]\s*(official\s*(video|audio|song|music\s*video|lyric[s]?)|full\s*(video|audio|song)|lyric[s]?\s*(video|song)?|4[kK]|8[kK]|hd|1080p|720p|remaster(ed)?|music\s*video|video\s*song|t[-\s]?series|sony music|zee music|saregama|tips official|eros now|t)\s*$/gi;
const TITLE_TRAILING_TOKENS_RE = /\s+(full\s*video\s*song|full\s*audio\s*song|full\s*video|full\s*audio|full\s*song|video\s*song|audio\s*song|official\s*video|official\s*audio|official\s*song|lyrical\s*video|lyric\s*video|title\s*track|title\s*song|song)\s*$/gi;

export function cleanTitle(raw = '') {
  let out = raw
    .trim()
    .replace(/^['"«“]+|['"»”]+$/g, '')
    .replace(TITLE_PREFIX_RE, '')
    .replace(TITLE_SUFFIX_RE, '')
    .replace(/\s*\((from|feat|ft|with|official|lyric|video|audio|full).*?\)/gi, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/^['"«“]+|['"»”]+$/g, '')
    .trim();

  let prev;
  do {
    prev = out;
    out = out.replace(TITLE_TRAILING_TOKENS_RE, '').trim();
  } while (out !== prev);

  return out;
}

export function cleanArtist(raw = '') {
  return raw
    .replace(/\s*[,&].+$/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

export function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);

  let fullCleaned = cleanTitle(parts[0] || rawTitle);
  let songName = fullCleaned;

  // Only split on ' - ' if the segment after dash looks like a movie/album name, not part of the song title
  if (fullCleaned.includes(' - ')) {
    const dashParts = fullCleaned.split(' - ');
    if (dashParts[0].trim().length >= 3) {
      songName = cleanTitle(dashParts[0]);
    }
  }

  const metaArtist = cleanArtist(rawArtist);
  if (metaArtist && metaArtist.length >= 2 && !isBlockedArtist(metaArtist)) {
    return { songName, artist: metaArtist };
  }

  const knownArtistPatterns = [
    /arijit/i, /jubin/i, /badshah/i, /shreya/i, /udit/i, /kumar sanu/i,
    /lata/i, /kishore/i, /mohd rafi/i, /sonu nigam/i, /sunidhi/i,
    /armaan/i, /atif/i, /anuv/i, /vishal/i, /shekhar/i, /shankar/i,
    /pritam/i, /amit trivedi/i, /a\.r\. rahman/i, /ar rahman/i,
    /ap dhillon/i, /karan aujla/i, /divine/i, /kaka/i, /darshan/i,
    /neha kakkar/i, /prateek/i, /kk/i, /alka yagnik/i, /sambata/i,
    /meet bros/i, /kanika/i, /mika/i, /guru randhawa/i, /yo yo/i, /honey singh/i,
  ];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const isLikelyArtist = knownArtistPatterns.some((re) => re.test(part));
    if (isLikelyArtist && !isBlockedArtist(part)) {
      const artist = part.split(',')[0].trim();
      return { songName, artist };
    }
  }

  if (parts.length >= 2) {
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts[i].split(',')[0].trim();
      if (!isBlockedArtist(candidate) && candidate.length >= 3) {
        return { songName, artist: candidate };
      }
    }
  }

  return { songName, artist: metaArtist || '' };
}

export async function findLyrics(rawArtist, rawTitle) {
  const { songName, artist } = parseYouTubeTitle(rawTitle, rawArtist);
  const ct = cleanTitle(rawTitle);
  const ca = cleanArtist(rawArtist);

  const rawAttempts = [];
  if (artist && songName) rawAttempts.push([artist, songName]);
  if (ca && ct && !isBlockedArtist(ca)) rawAttempts.push([ca, ct]);
  if (artist && ct && ct !== songName) rawAttempts.push([artist, ct]);
  if (songName && songName.length >= 4) rawAttempts.push(['', songName]);

  const seen = new Set();
  const attempts = rawAttempts
    .filter(([a, t]) => {
      if (!t) return false;
      const k = `${(a || '').toLowerCase()}::${(t || '').toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_ATTEMPTS);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[LYRICS LOOKUP] Title: "${songName || ct}" | Artist: "${artist || ca}" | RawTitle: "${rawTitle}" | RawArtist: "${rawArtist}"`);
  }

  const startTime = Date.now();
  let lastFailure = null;

  for (const [a, t] of attempts) {
    if (Date.now() - startTime > OVERALL_BUDGET_MS) {
      console.warn('[LYRICS] Overall time budget exceeded');
      break;
    }

    const key = cacheKey(a, t);
    const cached = fromCache(key);

    if (cached) {
      if (process.env.NODE_ENV !== 'production') console.log('[LYRICS CACHE HIT]', key);
      if (cached.found) return cached;
      lastFailure = cached;
      continue;
    }

    const result = await withTimeout(getLyrics(a, t), PER_CALL_TIMEOUT_MS);

    if (result.found && result.lyrics && result.lyrics.length > 0) {
      toCache(key, result);
      return result;
    }

    if (result.reason === 'not_found') {
      toCache(key, result);
      lastFailure = result;
      continue;
    }

    lastFailure = result;
  }

  return {
    found: false,
    artist: artist || ca || '',
    title: songName || ct || rawTitle,
    lyrics: null,
    source: 'none',
    reason: lastFailure?.reason || 'not_found',
  };
}