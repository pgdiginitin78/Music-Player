const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";

const BLOCKED_ARTISTS = new Set([
  't-series', 'tseries', 'sony music india', 'zee music company', 'saregama music',
  'tips official', 'eros now music', 'yrf', 'dharmatic entertainment',
  'universal music india', 'warner music india', 'junglee music',
  'speed records', 'desi music factory', 'vyrl originals',
]);

function isBlockedArtist(name = '') {
  return BLOCKED_ARTISTS.has(name.toLowerCase().trim());
}

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

export function parseYouTubeTitle(rawTitle = '', rawArtist = '') {
  const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);
  const songName = cleanTitle(parts[0] || rawTitle);

  const metaArtist = cleanArtist(rawArtist);
  if (metaArtist && metaArtist.length >= 3 && !isBlockedArtist(metaArtist)) {
    return { songName, artist: metaArtist };
  }

  const knownPatterns = [
    /arijit/i, /jubin/i, /badshah/i, /shreya/i, /udit/i, /sambata/i,
    /sunidhi/i, /armaan/i, /atif/i, /anuv/i, /vishal/i, /pritam/i,
    /a\.r\. rahman/i, /karan ajula/i, /shankar/i, /amit trivedi/i,
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

  return { songName, artist: '' };
}

async function fetchFromBackend(artist, title, signal) {
  const params = new URLSearchParams();
  if (artist) params.set('artist', artist);
  if (title)  params.set('title',  title);
  const res = await fetch(`${API_URL}/lyrics?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchLyrics(song, signal) {
  if (!song) return null;

  const rawTitle  = (song.title  || '').trim();
  const rawArtist = (song.artist || '').trim();

  if (!rawTitle && !rawArtist) return null;

  const data = await fetchFromBackend(rawArtist, rawTitle, signal);

  if (data.found && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
    return data.lyrics;
  }
  return null;
}