import { API_BASE_URL } from '../config/env.js';

export async function fetchLyrics(song, signal) {
  if (!song) return { success: false, found: false, lyrics: null, message: 'No song provided' };

  const rawTitle  = (song.title  || '').trim();
  const rawArtist = (song.artist || '').trim();

  if (!rawTitle && !rawArtist) {
    return { success: false, found: false, lyrics: null, message: 'Missing song information' };
  }

  const params = new URLSearchParams();
  if (rawArtist) params.set('artist', rawArtist);
  if (rawTitle)  params.set('title',  rawTitle);

  try {
    const res = await fetch(`${API_BASE_URL}/lyrics?${params.toString()}`, { signal });

    if (!res.ok) {
      return { success: false, found: false, lyrics: null, message: 'Unable to load lyrics' };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.error('[LYRICS MOBILE SERVICE ERROR]', err.message);
    return { success: false, found: false, lyrics: null, message: 'Unable to load lyrics' };
  }
}
