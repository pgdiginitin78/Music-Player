const TIMEOUT_MS = 6000;
const BASE_URL = 'https://lrclib.net/api';

function normaliseLyricsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // Strip LRC timestamps like [00:12.34], [01:23.456], [00:12], etc.
  const cleanedText = rawText
    .replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '')
    .replace(/<.*?>/g, '');

  const lines = cleanedText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  return lines;
}

function normalizeStr(str = '') {
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isMatchConfident(queryTitle, queryArtist, resultTitle, resultArtist) {
  const normQT = normalizeStr(queryTitle);
  const normRT = normalizeStr(resultTitle);

  if (!normQT || !normRT) return false;

  // 1. Strict Title Match
  let titleMatches = false;
  if (normQT === normRT) {
    titleMatches = true;
  } else if (normQT.length > 5 && normRT.length > 5) {
    // For titles > 5 chars, one can contain the other ONLY if length ratio >= 0.75
    const ratio = Math.min(normQT.length, normRT.length) / Math.max(normQT.length, normRT.length);
    if (ratio >= 0.75 && (normQT.includes(normRT) || normRT.includes(normQT))) {
      titleMatches = true;
    }
  }

  if (!titleMatches) return false;

  // 2. Strict Artist Match (when query artist is provided)
  if (queryArtist && resultArtist) {
    const normQA = normalizeStr(queryArtist);
    const normRA = normalizeStr(resultArtist);
    if (normQA && normRA) {
      const artistMatches = normQA === normRA || normQA.includes(normRA) || normRA.includes(normQA);
      if (!artistMatches) return false;
    }
  }

  return true;
}

export async function fetchFromLrclib(artist, title) {
  if (!title) {
    return { found: false, lyrics: null, reason: 'missing_params' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1. Exact GET request if artist is provided
    if (artist) {
      const getUrl = `${BASE_URL}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[LYRICS LOOKUP] Provider: LRCLIB | Title: "${title}" | Artist: "${artist}"`);
      }

      try {
        const res = await fetch(getUrl, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const lines = normaliseLyricsText(data?.plainLyrics || data?.syncedLyrics);
          const confident = isMatchConfident(title, artist, data?.trackName, data?.artistName);

          if (process.env.NODE_ENV !== 'production') {
            console.log(`[LYRICS MATCH GET] Candidate: "${data?.trackName}" by "${data?.artistName}" | Confident: ${confident} | Lines: ${lines ? lines.length : 0}`);
          }

          if (confident && lines && lines.length > 0) {
            clearTimeout(timer);
            return { found: true, lyrics: lines, source: 'lrclib' };
          }
        }
      } catch (err) {
        // Fall through to search
      }
    }

    // 2. Multi-tier search queries (q parameter for flexible artist/composer matching)
    const searchQueries = [
      `${BASE_URL}/search?q=${encodeURIComponent(`${title} ${artist}`.trim())}`,
      `${BASE_URL}/search?track_name=${encodeURIComponent(title)}${artist ? `&artist_name=${encodeURIComponent(artist)}` : ''}`,
      `${BASE_URL}/search?track_name=${encodeURIComponent(title)}`,
    ];

    for (const searchUrl of searchQueries) {
      if (controller.signal.aborted) break;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[LYRICS SEARCH] Provider: LRCLIB | URL: ${searchUrl}`);
      }

      try {
        const res = await fetch(searchUrl, { signal: controller.signal });
        if (res.ok) {
          const searchResults = await res.json();
          if (Array.isArray(searchResults) && searchResults.length > 0) {
            for (const item of searchResults) {
              const lines = normaliseLyricsText(item?.plainLyrics || item?.syncedLyrics);
              const confident = isMatchConfident(title, artist, item?.trackName, item?.artistName);

              if (process.env.NODE_ENV !== 'production') {
                console.log(`[LYRICS MATCH SEARCH] Candidate: "${item?.trackName}" by "${item?.artistName}" | Confident: ${confident} | Lines: ${lines ? lines.length : 0}`);
              }

              if (confident && lines && lines.length > 0) {
                clearTimeout(timer);
                return { found: true, lyrics: lines, source: 'lrclib' };
              }
            }
          }
        }
      } catch (err) {
        // Try next search query
      }
    }

    clearTimeout(timer);
    return { found: false, lyrics: null, reason: 'not_found' };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    const reason = isTimeout ? 'timeout' : 'provider_error';
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[LYRICS ERROR] LRCLIB: ${reason} - ${err.message}`);
    }
    return { found: false, lyrics: null, reason };
  }
}
