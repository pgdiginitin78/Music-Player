const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";

const BLOCKED_ARTISTS = new Set([
  't-series', 'tseries', 'series', 't series', 'sony music india', 'zee music company', 'saregama music',
  'tips official', 'eros now music', 'yrf', 'dharmatic entertainment',
  'universal music india', 'warner music india', 'junglee music',
  'speed records', 'desi music factory', 'vyrl originals', 'unknown artist',
  't-series pop chartbusters', 'tips music', 'sony music', 'zee music',
  'official', 'channel', 'records', 'company', 'entertainment', 'music',
]);

function isBlockedArtist(name = '') {
  if (!name) return true;
  const clean = name.toLowerCase().trim();
  if (clean.length < 2) return true;
  return BLOCKED_ARTISTS.has(clean);
}

const TITLE_PREFIX_RE = /^(full\s*(video|audio|song|lyric[s]?|hd|4k|8k)|official\s*(video|audio|song|lyric[s]?|music\s*video)|lyric[s]?\s*(video|song)?|audio\s*(song|video)?|video\s*song|music\s*video|song|lyrical\s*(video)?)\s*[:\-|]?\s*/gi;
const TITLE_SUFFIX_RE = /\s*[\|\-]\s*(official\s*(video|audio|song|music\s*video|lyric[s]?)|full\s*(video|audio|song)|lyric[s]?\s*(video|song)?|4[kK]|hd|1080p|720p|remaster(ed)?|music\s*video|video\s*song|t[-\s]?series|sony music|zee music|saregama|tips official|eros now|t)\s*$/gi;
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
    .replace(/\s*[,&]\s*.+$/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
}

export function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);
  let fullCleaned = cleanTitle(parts[0] || rawTitle);
  let songName = fullCleaned;

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

  const knownPatterns = [
    /arijit/i, /jubin/i, /badshah/i, /shreya/i, /udit/i, /sonu nigam/i,
    /sunidhi/i, /armaan/i, /atif/i, /anuv/i, /vishal/i, /pritam/i,
    /a\.r\. rahman/i, /ar rahman/i, /shankar/i, /amit trivedi/i,
    /meet bros/i, /kanika/i, /mika/i, /guru randhawa/i, /yo yo/i, /honey singh/i,
  ];

  for (let i = 1; i < parts.length; i++) {
    if (knownPatterns.some((re) => re.test(parts[i])) && !isBlockedArtist(parts[i])) {
      return { songName, artist: parts[i].split(',')[0].trim() };
    }
  }

  for (let i = parts.length - 1; i >= 1; i--) {
    const c = parts[i].split(',')[0].trim();
    if (!isBlockedArtist(c) && c.length >= 3) {
      return { songName, artist: c };
    }
  }

  return { songName, artist: metaArtist || '' };
}

export async function fetchLyrics(song, signal) {
  if (!song) return { success: false, found: false, lyrics: null, message: "No song provided" };

  const rawTitle  = (song.title  || '').trim();
  const rawArtist = (song.artist || '').trim();

  if (!rawTitle && !rawArtist) {
    return { success: false, found: false, lyrics: null, message: "Missing song information" };
  }

  const params = new URLSearchParams();
  if (rawArtist) params.set('artist', rawArtist);
  if (rawTitle)  params.set('title',  rawTitle);

  try {
    const res = await fetch(`${API_URL}/lyrics?${params.toString()}`, { signal });

    if (!res.ok) {
      return { success: false, found: false, lyrics: null, message: "Unable to load lyrics" };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    console.error('[LYRICS SERVICE ERROR]', err.message);
    return { success: false, found: false, lyrics: null, message: "Unable to load lyrics" };
  }
}