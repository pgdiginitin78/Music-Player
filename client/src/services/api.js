/**
 * Frontend API Service
 *
 * All fetch() calls have:
 *  - AbortController support (caller can cancel)
 *  - 15-second timeout (prevents permanent loading state if server hangs)
 *  - Response normalization via normalizeSong
 *  - Diagnostic response logging
 */

import { normalizeSong } from './songNormalizer.js';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";

// Default timeout for all API requests (15 seconds)
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Wrapper around fetch() that adds a timeout and signal handling.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const callerSignal = options.signal;
  const timeoutSignal = timeoutController.signal;

  let combinedController = timeoutController;
  if (callerSignal) {
    combinedController = new AbortController();
    const abort = () => combinedController.abort();
    callerSignal.addEventListener('abort', abort);
    timeoutSignal.addEventListener('abort', abort);
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: combinedController.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getCategories = async (signal) => {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/categories`,
      { signal },
      10_000
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.categories || []);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[API] getCategories aborted or timed out');
    } else {
      console.error('[API] getCategories error:', error.message);
    }
    throw error;
  }
};

export const getCategoryBySlug = async (slug, signal) => {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/categories/${slug}`,
      { signal },
      10_000
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch category ${slug}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[API] getCategoryBySlug(${slug}) aborted or timed out`);
    } else {
      console.error(`[API] getCategoryBySlug(${slug}) error:`, error.message);
    }
    throw error;
  }
};

export const getSongs = async (params = {}, signal) => {
  try {
    const queryParams = new URLSearchParams();
    if (params.category) queryParams.append('category', params.category);
    if (params.search)   queryParams.append('search',   params.search);
    if (params.artist)   queryParams.append('artist',   params.artist);
    if (params.page)     queryParams.append('page',     params.page);
    if (params.limit)    queryParams.append('limit',    params.limit);

    const queryString = queryParams.toString();
    const url = `${API_URL}/songs${queryString ? `?${queryString}` : ''}`;

    const t0 = Date.now();
    const response = await fetchWithTimeout(url, { signal }, DEFAULT_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Failed to fetch songs: ${response.status}`);
    }

    const data = await response.json();
    const rawList = Array.isArray(data) ? data : (data.songs || []);
    const normalizedSongs = rawList.map(normalizeSong).filter(Boolean);

    // Diagnostic logging (NO SECRETS LOGGED)
    console.log('[API DIAGNOSTIC]', {
      environment: import.meta.env.MODE || 'production',
      endpoint: url,
      status: response.status,
      songCount: normalizedSongs.length,
      category: params.category || 'all',
      durationMs: Date.now() - t0,
      firstSong: normalizedSongs[0] ? {
        id: normalizedSongs[0].id,
        youtubeVideoId: normalizedSongs[0].youtubeVideoId,
        title: normalizedSongs[0].title,
        coverImage: normalizedSongs[0].coverImage
      } : null
    });

    return normalizedSongs;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[API] getSongs aborted or timed out');
    } else {
      console.error('[API] getSongs error:', error.message);
    }
    throw error;
  }
};

export const getSongPlaybackInfo = async (id, signal) => {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/songs/${id}/playback`,
      { signal },
      10_000
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Playback information unavailable');
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[API] getSongPlaybackInfo(${id}) aborted or timed out`);
    } else {
      console.error(`[API] getSongPlaybackInfo(${id}) error:`, error.message);
    }
    throw error;
  }
};
