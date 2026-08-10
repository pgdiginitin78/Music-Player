/**
 * lyricsOvhProvider.js
 *
 * Fetches lyrics from the lyrics.ovh public API.
 * Returns { found, lyrics[], reason } — never throws.
 */

const TIMEOUT_MS = 8000;
const BASE_URL = 'https://api.lyrics.ovh/v1';

/**
 * Normalise raw lyrics text into a clean string[] of lines.
 * Rejects garbage/HTML/too-short payloads.
 */
function normaliseLines(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.trim().startsWith('<')) return null; // HTML error page

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean); // remove blank lines

  // Require at least 4 meaningful lines
  if (lines.length < 4) return null;
  // Require at least 80 characters total — reject 1-line "not found" responses
  if (lines.join(' ').length < 80) return null;

  return lines;
}

/**
 * Fetch from lyrics.ovh with timeout.
 * @param {string} artist
 * @param {string} title
 * @returns {{ found: boolean, lyrics: string[], reason?: string }}
 */
export async function fetchFromOvh(artist, title) {
  if (!artist || !title) {
    return { found: false, lyrics: [], reason: 'missing_params' };
  }

  const url = `${BASE_URL}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  console.log('[LYRICS REQUEST]', { artist, title, url });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const reason = res.status === 404 ? 'not_found' : 'provider_error';
      console.log('[LYRICS RESPONSE]', { found: false, reason, status: res.status });
      return { found: false, lyrics: [], reason };
    }

    const data = await res.json();
    const lines = normaliseLines(data?.lyrics);

    if (!lines) {
      console.log('[LYRICS RESPONSE]', { found: false, reason: 'not_found' });
      return { found: false, lyrics: [], reason: 'not_found' };
    }

    console.log('[LYRICS RESPONSE]', { found: true, lineCount: lines.length, source: 'lyrics.ovh' });
    return { found: true, lyrics: lines, source: 'lyrics.ovh' };

  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    const reason = isTimeout ? 'timeout' : 'provider_error';
    console.log('[LYRICS RESPONSE]', { found: false, reason, error: err.message });
    return { found: false, lyrics: [], reason };
  }
}
