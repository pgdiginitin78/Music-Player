/**
 * JioSaavn Music Service - Legal Direct Audio Provider
 * Fetches real Hindi vocal songs, category collections, artist catalogs,
 * and high-resolution artwork with direct audio URLs (320kbps / 160kbps / 128kbps AAC/MP3).
 */

const API_MIRRORS = [
  'https://saavn.me',
  'https://jiosaavn-api-sigma.vercel.app',
  'https://jiosaavn-api-v3.vercel.app',
  'https://saavn-api.vercel.app'
];

/**
 * Normalizes image array to highest available resolution URL
 */

const getHighestQualityImage = (images) => {
  if (!images) return '/images/default-album.webp';
  if (typeof images === 'string') return images;
  if (Array.isArray(images) && images.length > 0) {
    // Sort by resolution quality if quality field exists
    const sorted = [...images].sort((a, b) => {
      const qA = parseInt(a.quality || a.height || '0', 10);
      const qB = parseInt(b.quality || b.height || '0', 10);
      return qB - qA;
    });
    return sorted[0]?.url || sorted[0]?.link || images[images.length - 1]?.url || '/images/default-album.webp';
  }
  return '/images/default-album.webp';
};

/**
 * Selects highest quality direct audio stream link
 * 320kbps > 160kbps > 128kbps
 */
const selectBestAudioStream = (downloadUrls) => {
  if (!downloadUrls) return { url: null, quality: 'Quality unavailable', bitrate: null, format: null };
  if (typeof downloadUrls === 'string') {
    return { url: downloadUrls, quality: '320kbps AAC', bitrate: 320, format: 'aac' };
  }

  if (Array.isArray(downloadUrls) && downloadUrls.length > 0) {
    // Sort descending by quality (320kbps > 160kbps > 128kbps)
    const sorted = [...downloadUrls].sort((a, b) => {
      const bA = parseInt((a.quality || '').replace(/\D/g, '') || '0', 10);
      const bB = parseInt((b.quality || '').replace(/\D/g, '') || '0', 10);
      return bB - bA;
    });

    const best = sorted[0];
    const url = best?.url || best?.link;
    const rawBitrate = parseInt((best?.quality || '').replace(/\D/g, ''), 10) || 320;
    const format = url?.endsWith('.mp3') ? 'MP3' : 'AAC';
    const qualityLabel = `${rawBitrate}kbps ${format}`;

    return {
      url: url || null,
      quality: qualityLabel,
      bitrate: rawBitrate,
      format: format.toLowerCase()
    };
  }

  return { url: null, quality: 'Quality unavailable', bitrate: null, format: null };
};

/**
 * Converts duration string or number into seconds
 */
const parseDuration = (dur) => {
  if (!dur) return 210;
  if (typeof dur === 'number') return Math.floor(dur);
  if (typeof dur === 'string' && dur.includes(':')) {
    const parts = dur.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseInt(dur, 10) || 210;
};

/**
 * Normalizes raw JioSaavn song object into standard Song Model
 */
export const normalizeJioSaavnSong = (rawTrack, categoryHint = 'bollywood-hits') => {
  if (!rawTrack || typeof rawTrack !== 'object') return null;

  const id = String(rawTrack.id || rawTrack._id || rawTrack.songId || '');
  if (!id) return null;

  const title = (rawTrack.name || rawTrack.title || rawTrack.song || 'Untitled Track').trim();
  
  // Extract primary artists
  let artist = 'Unknown Artist';
  if (typeof rawTrack.primaryArtists === 'string' && rawTrack.primaryArtists.trim()) {
    artist = rawTrack.primaryArtists.trim();
  } else if (Array.isArray(rawTrack.primaryArtists) && rawTrack.primaryArtists.length > 0) {
    artist = rawTrack.primaryArtists.map(a => a.name || a).join(', ');
  } else if (rawTrack.artist) {
    artist = typeof rawTrack.artist === 'string' ? rawTrack.artist : (rawTrack.artist.name || 'Unknown Artist');
  } else if (rawTrack.singers) {
    artist = rawTrack.singers;
  }

  // Extract album name
  let album = 'Hindi Album';
  if (rawTrack.album) {
    album = typeof rawTrack.album === 'string' ? rawTrack.album : (rawTrack.album.name || 'Hindi Album');
  }

  const coverImage = getHighestQualityImage(rawTrack.image || rawTrack.artwork);
  const streamInfo = selectBestAudioStream(rawTrack.downloadUrl || rawTrack.media_url);

  const duration = parseDuration(rawTrack.duration);

  // Vocal filter: check if track is karaoke or purely instrumental (unless instrumental requested)
  const isInstrumental = /karaoke|instrumental|backing track|piano version/i.test(title);
  if (isInstrumental && categoryHint !== 'instrumental') {
    // Drop unwanted karaoke versions
    return null;
  }

  const isPlayable = Boolean(streamInfo.url);

  return {
    id: id,
    title: title,
    artist: artist,
    album: album,
    category: categoryHint || 'bollywood-hits',
    coverImage: coverImage,
    audioUrl: streamInfo.url,
    duration: duration,
    source: 'JioSaavn',
    quality: streamInfo.quality,
    bitrate: streamInfo.bitrate,
    format: streamInfo.format,
    isPreview: false,
    isPlayable: isPlayable
  };
};

/**
 * Map internal category slug to optimized JioSaavn search terms for rich Hindi vocal tracks
 */
const CATEGORY_SEARCH_MAP = {
  'for-you': 'Arijit Singh Hits 2026',
  'bollywood-hits': 'Bollywood Vocal Hits 2026',
  'latest-hindi': 'Latest Hindi Vocal Songs 2026',
  'trending-hindi': 'Trending Hindi Vocal Songs',
  'romantic-hindi': 'Romantic Hindi Vocal Songs',
  'sad-hindi': 'Sad Hindi Songs Ballads',
  'lo-fi-hindi': 'Lo-Fi Hindi Songs Vocals',
  'old-hindi': 'Kishore Kumar Lata Mangeshkar Old Hindi',
  'party-hindi': 'Hindi Party Vocal Dance Songs',
  'workout-hindi': 'Hindi Workout Energetic Songs',
  'rain-hindi': 'Monsoon Hindi Rain Melodies',
  'acoustic-hindi': 'Acoustic Hindi Vocals Unplugged',
  'indie-hindi': 'Anuv Jain Prateek Kuhad Indie Hindi'
};

/**
 * Executes fetch with timeout and mirror failover
 */
const fetchFromProviderMirrors = async (endpointPath) => {
  const customBaseUrl = process.env.MUSIC_API_URL;
  const urlsToTry = customBaseUrl 
    ? [customBaseUrl.replace(/\/$/, '') + endpointPath, ...API_MIRRORS.map(m => m + endpointPath)]
    : API_MIRRORS.map(m => m + endpointPath);

  for (const url of urlsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (json && (json.data || json.results || Array.isArray(json))) {
          return json;
        }
      }
    } catch (err) {
      console.warn(`[JIOSAAVN MIRROR TRY FAIL] ${url}:`, err.message);
    }
  }
  return null;
};

/**
 * Searches songs from JioSaavn catalog by query, category, or artist
 */
export const searchJioSaavnSongs = async ({ query = '', category = '', artist = '', page = 1, limit = 25 }) => {
  let searchTerm = '';

  if (artist) {
    searchTerm = `${artist} songs`;
  } else if (query) {
    searchTerm = query;
  } else if (category && CATEGORY_SEARCH_MAP[category]) {
    searchTerm = CATEGORY_SEARCH_MAP[category];
  } else {
    searchTerm = 'Top Hindi Vocal Songs';
  }

  const encodedQuery = encodeURIComponent(searchTerm.trim());
  const endpoint = `/api/search/songs?query=${encodedQuery}&page=${page}&limit=${limit}`;

  const responseData = await fetchFromProviderMirrors(endpoint);
  if (!responseData) {
    return { songs: [], total: 0 };
  }

  let rawList = [];
  if (responseData.data && Array.isArray(responseData.data.results)) {
    rawList = responseData.data.results;
  } else if (Array.isArray(responseData.data)) {
    rawList = responseData.data;
  } else if (Array.isArray(responseData.results)) {
    rawList = responseData.results;
  } else if (Array.isArray(responseData)) {
    rawList = responseData;
  }

  const categorySlug = category || 'bollywood-hits';
  const songs = rawList
    .map(track => normalizeJioSaavnSong(track, categorySlug))
    .filter(Boolean);

  return {
    songs: songs,
    total: songs.length,
    page: page,
    limit: limit
  };
};

/**
 * Fetches single song details by ID
 */
export const getJioSaavnSongById = async (id) => {
  if (!id) return null;
  const endpoint = `/api/songs?id=${encodeURIComponent(id)}`;
  const responseData = await fetchFromProviderMirrors(endpoint);

  if (!responseData) return null;

  let rawTrack = null;
  if (responseData.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
    rawTrack = responseData.data[0];
  } else if (responseData.data && typeof responseData.data === 'object') {
    rawTrack = responseData.data;
  } else if (Array.isArray(responseData) && responseData.length > 0) {
    rawTrack = responseData[0];
  }

  if (!rawTrack) return null;
  return normalizeJioSaavnSong(rawTrack, 'for-you');
};
