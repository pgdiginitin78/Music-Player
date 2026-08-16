import { normalizeSong } from './songNormalizer.js';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";

const DEFAULT_TIMEOUT_MS = 15_000;

// Device & User Identity Utilities
export function getDeviceId() {
  if (typeof window === 'undefined') return 'device_server';
  let devId = localStorage.getItem('pulsemind_device_id');
  if (!devId) {
    devId = `device_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    localStorage.setItem('pulsemind_device_id', devId);
  }
  return devId;
}

export function getUserId() {
  if (typeof window === 'undefined') return 'default_user';
  let uId = localStorage.getItem('pulsemind_user_id');
  if (!uId) {
    uId = `user_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('pulsemind_user_id', uId);
  }
  return uId;
}

export function getMacAddress() {
  if (typeof window === 'undefined') return 'mac_server_default';
  let mac = localStorage.getItem('pulsemind_mac_address');
  if (!mac) {
    mac = localStorage.getItem('pulsemind_device_id') || `mac_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    localStorage.setItem('pulsemind_mac_address', mac);
  }
  return mac;
}

export function getAuthHeaders() {
  const mac = getMacAddress();
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    'x-device-id': getDeviceId(),
    'x-mac-address': mac,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const callerSignal = options.signal;

  let combinedController = timeoutController;
  if (callerSignal) {
    combinedController = new AbortController();
    const abort = () => combinedController.abort();
    callerSignal.addEventListener('abort', abort);
    timeoutController.signal.addEventListener('abort', abort);
  }

  const mergedHeaders = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: combinedController.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const sendParoCommandApi = async (message, playerState = {}, requestId = 0, signal = null) => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/paro/command`, {
      method: 'POST',
      body: JSON.stringify({ message, playerState, requestId }),
      signal,
    });

    if (!res.ok) throw new Error(`PARO API error: ${res.status}`);
    const data = await res.json();
    if (data.songs && Array.isArray(data.songs)) {
      data.songs = data.songs.map(normalizeSong).filter(Boolean);
    }
    return data;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[API] sendParoCommandApi error:', err.message);
    }
    throw err;
  }
};

export const sendPulseMindChatMessage = async (message, playerState = {}, sessionContext = null) => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/pulsemind/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, playerState, sessionContext }),
    });

    if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
    const data = await res.json();
    if (data.songs && Array.isArray(data.songs)) {
      data.songs = data.songs.map(normalizeSong).filter(Boolean);
    }
    return data;
  } catch (err) {
    console.error('[API] sendPulseMindChatMessage error:', err.message);
    return {
      success: false,
      reply: "I've got you 🎧 Let's start something chill.",
      actions: [{ type: 'PLAY_RECOMMENDED_QUEUE', mode: 'for-you', params: {} }],
      songs: [],
    };
  }
};

export const logPulseEventApi = async (eventData = {}) => {
  try {
    await fetchWithTimeout(`${API_URL}/pulsemind/events`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  } catch (err) {
    console.warn('[API] logPulseEventApi error:', err.message);
  }
};

export const getPulseMindRecommendations = async (mode = 'for-you', debug = false) => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/pulsemind/recommendations?mode=${mode}&debug=${debug}`);
    if (!res.ok) throw new Error(`Recommendations error: ${res.status}`);
    const data = await res.json();
    const rawList = data.songs || [];
    return {
      ...data,
      songs: rawList.map(normalizeSong).filter(Boolean),
    };
  } catch (err) {
    console.error('[API] getPulseMindRecommendations error:', err.message);
    return { success: false, songs: [] };
  }
};

export const fetchPulseMindProfile = async () => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/pulsemind/profile`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    return await res.json();
  } catch (err) {
    console.error('[API] fetchPulseMindProfile error:', err.message);
    return { success: false };
  }
};

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

export const getRecommendations = async (mode = 'for-you', likedIds = [], signal) => {
  try {
    const queryParams = new URLSearchParams();
    if (likedIds.length > 0) queryParams.append('likedIds', likedIds.join(','));

    const queryString = queryParams.toString();
    const url = `${API_URL}/recommendations/${mode}${queryString ? `?${queryString}` : ''}`;

    const response = await fetchWithTimeout(url, { signal }, DEFAULT_TIMEOUT_MS);
    if (!response.ok) throw new Error(`Failed to fetch recommendations: ${response.status}`);

    const data = await response.json();
    const rawList = data.songs || [];
    const normalizedSongs = rawList.map(normalizeSong).filter(Boolean);

    return {
      songs: normalizedSongs,
      algorithm: data.algorithm || 'PulseMind AI',
      mode: data.mode || mode,
    };
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(`[API] getRecommendations(${mode}) error:`, error.message);
    }
    throw error;
  }
};

export const getSongs = async (params = {}, signal) => {
  try {
    const queryParams = new URLSearchParams();
    if (params.category)   queryParams.append('category', params.category);
    if (params.search)     queryParams.append('search', params.search);
    if (params.artist)     queryParams.append('artist', params.artist);
    if (params.pageToken)  queryParams.append('pageToken', params.pageToken);
    if (params.limit && Number.isFinite(params.limit)) queryParams.append('limit', params.limit);
    queryParams.append('paginated', 'true');

    const queryString = queryParams.toString();
    const url = `${API_URL}/songs?${queryString}`;

    const response = await fetchWithTimeout(url, { signal }, DEFAULT_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Failed to fetch songs: ${response.status}`);
    }

    const data = await response.json();
    const rawList = Array.isArray(data) ? data : (data.songs || []);
    const normalizedSongs = rawList.map(normalizeSong).filter(Boolean);

    return {
      songs: normalizedSongs,
      nextPageToken: data.nextPageToken || null,
      hasMore: !!data.nextPageToken,
      total: data.total ?? normalizedSongs.length,
    };
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

export const fetchLikedSongs = async (signal) => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/liked`, { signal }, 10_000);
    if (!res.ok) throw new Error('Failed to fetch liked songs');
    const data = await res.json();
    return (data.songs || []).map(normalizeSong).filter(Boolean);
  } catch (err) {
    console.error('[API] fetchLikedSongs error:', err.message);
    return [];
  }
};

export const likeSongApi = async (song) => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/liked`, {
      method: 'POST',
      body: JSON.stringify({ song }),
    });
    return await res.json();
  } catch (err) {
    console.error('[API] likeSongApi error:', err.message);
    return { success: false };
  }
};

export const unlikeSongApi = async (songId) => {
  try {
    const res = await fetchWithTimeout(`${API_URL}/liked/${encodeURIComponent(songId)}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err) {
    console.error('[API] unlikeSongApi error:', err.message);
    return { success: false };
  }
};