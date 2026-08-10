import mongoose from 'mongoose';
import YouTubeCache from '../../models/YouTubeCache.js';

const categoryQueries = {
  'for-you': ['Hindi songs official', 'Bollywood hits official'],
  'bollywood-hits': ['Bollywood Hindi hits official'],
  'latest-hindi': ['Latest Hindi songs official'],
  'trending-hindi': ['Trending Hindi songs official'],
  'romantic-hindi': ['Romantic Hindi songs official'],
  'sad-hindi': ['Sad Hindi songs official'],
  'lo-fi-hindi': ['Lo-Fi Hindi songs official'],
  'old-hindi': ['Old Hindi Bollywood songs official'],
  'party-hindi': ['Party Hindi songs official'],
  'workout-hindi': ['Workout Hindi songs official'],
  'rain-hindi': ['Rain Hindi songs official'],
  'acoustic-hindi': ['Acoustic Hindi songs official'],
  'indie-hindi': ['Hindi indie songs official']
};

// In-memory cache fallback if MongoDB is disconnected
const inMemoryCache = new Map();

/**
 * Parses ISO 8601 YouTube video duration string (e.g. "PT3M45S", "PT1H2M3S") to seconds.
 */
export function parseISO8601Duration(isoDuration) {
  if (!isoDuration || typeof isoDuration !== 'string') return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Helper to clean title and attempt to extract title & artist from YouTube video snippet
 */
export function parseVideoTitleAndArtist(title, channelTitle) {
  let cleanTitle = title
    .replace(/\(Official Video\)/gi, '')
    .replace(/\[Official Video\]/gi, '')
    .replace(/\(Official Music Video\)/gi, '')
    .replace(/\[Official Music Video\]/gi, '')
    .replace(/\(Audio\)/gi, '')
    .replace(/\[Audio\]/gi, '')
    .replace(/\(Lyrical\)/gi, '')
    .replace(/\[Lyrical\]/gi, '')
    .replace(/ Full Video/gi, '')
    .replace(/ Official Song/gi, '')
    .replace(/ HD/gi, '')
    .replace(/ 4K/gi, '')
    .trim();

  let artist = channelTitle ? channelTitle.replace(/VEVO|Official|Music|Records|Series|TV/gi, '').trim() : 'Hindi Artist';
  
  if (cleanTitle.includes('-')) {
    const parts = cleanTitle.split('-');
    if (parts.length >= 2) {
      const firstPart = parts[0].trim();
      const secondPart = parts.slice(1).join('-').trim();
      
      // Usually "Song Name - Artist" or "Artist - Song Name"
      if (firstPart.length > 0 && secondPart.length > 0) {
        cleanTitle = firstPart;
        artist = secondPart;
      }
    }
  }

  if (!artist || artist.length < 2) {
    artist = channelTitle || 'Hindi Artist';
  }

  return { title: cleanTitle, artist };
}

/**
 * Filter video for obvious non-song content
 */
function isPlayableSongVideo(snippet, contentDetails, status) {
  // Must be embeddable & public
  if (status) {
    if (status.embeddable === false) return false;
    if (status.privacyStatus && status.privacyStatus !== 'public') return false;
    if (status.uploadStatus && status.uploadStatus !== 'processed') return false;
  }

  const durationSec = parseISO8601Duration(contentDetails?.duration);
  // Exclude Shorts (< 50 seconds) and excessive videos (> 25 minutes)
  if (durationSec < 50 || durationSec > 1500) {
    return false;
  }

  const titleLower = (snippet.title || '').toLowerCase();
  const descLower = (snippet.description || '').toLowerCase();
  const combined = titleLower + ' ' + descLower;

  // Filter unwanted keywords per requirement 47
  const rejectedKeywords = [
    'karaoke', 'instrumental', 'backing track', 'reaction', 'tutorial',
    'cover by', 'shorts', '#shorts', 'slowed+reverb', 'slowed and reverb',
    'slowed reverb', '8d audio', 'teaser', 'trailer', 'making of', 'behind the scenes'
  ];

  for (const kw of rejectedKeywords) {
    if (combined.includes(kw)) {
      return false;
    }
  }

  return true;
}

/**
 * Query YouTube Data API v3 search.list and videos.list
 */
export async function searchYouTubeVideos(query, categorySlug = 'for-you', limit = 25, pageToken = '') {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not defined in server environment.');
  }

  const cacheKey = `yt_${categorySlug}_${query}_${limit}_${pageToken}`;

  // 1. Check MongoDB cache first
  if (mongoose.connection.readyState === 1) {
    try {
      const cached = await YouTubeCache.findOne({ cacheKey, expiresAt: { $gt: new Date() } });
      if (cached && cached.results && cached.results.length > 0) {
        console.log(`[YOUTUBE CACHE HIT] Query: "${query}", Category: "${categorySlug}" (${cached.results.length} items)`);
        return {
          songs: cached.results,
          total: cached.results.length,
          page: 1,
          limit,
          nextPageToken: cached.nextPageToken || null
        };
      }
    } catch (err) {
      console.warn('[YOUTUBE CACHE WARN] MongoDB cache lookup failed:', err.message);
    }
  } else if (inMemoryCache.has(cacheKey)) {
    const cached = inMemoryCache.get(cacheKey);
    if (cached.expiresAt > Date.now()) {
      console.log(`[IN-MEMORY CACHE HIT] Query: "${query}", Category: "${categorySlug}"`);
      return cached.data;
    }
  }

  console.log(`[YOUTUBE API FETCH] Querying YouTube Data API v3 for: "${query}" (maxResults: ${limit})`);

  // Step 1: Call search.list
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.append('part', 'snippet');
  searchUrl.searchParams.append('type', 'video');
  searchUrl.searchParams.append('videoCategoryId', '10'); // Music category
  searchUrl.searchParams.append('q', query);
  searchUrl.searchParams.append('maxResults', String(Math.min(limit, 50)));
  searchUrl.searchParams.append('key', apiKey);
  if (pageToken) {
    searchUrl.searchParams.append('pageToken', pageToken);
  }

  let searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    console.warn(`[YOUTUBE SEARCH WARN] Category 10 search returned status ${searchRes.status}. Retrying without videoCategoryId...`);
    // Fallback search without videoCategoryId 10 if restricted
    searchUrl.searchParams.delete('videoCategoryId');
    searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      throw new Error(`YouTube API search failed (${searchRes.status}): ${errBody}`);
    }
  }

  const searchData = await searchRes.json();
  const rawItems = searchData.items || [];
  const nextPageToken = searchData.nextPageToken || null;

  if (rawItems.length === 0) {
    return { songs: [], total: 0, page: 1, limit, nextPageToken: null };
  }

  const videoIds = rawItems.map(item => item.id?.videoId).filter(Boolean);

  if (videoIds.length === 0) {
    return { songs: [], total: 0, page: 1, limit, nextPageToken: null };
  }

  // Step 2: Call videos.list for video details and validation
  const videoDetailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videoDetailsUrl.searchParams.append('part', 'snippet,contentDetails,status');
  videoDetailsUrl.searchParams.append('id', videoIds.join(','));
  videoDetailsUrl.searchParams.append('key', apiKey);

  const videoDetailsRes = await fetch(videoDetailsUrl.toString());
  if (!videoDetailsRes.ok) {
    const errBody = await videoDetailsRes.text();
    throw new Error(`YouTube API videos.list failed (${videoDetailsRes.status}): ${errBody}`);
  }

  const videoDetailsData = await videoDetailsRes.json();
  const videoMap = new Map((videoDetailsData.items || []).map(v => [v.id, v]));

  const normalizedSongs = [];

  for (const rawItem of rawItems) {
    const videoId = rawItem.id?.videoId;
    if (!videoId) continue;

    const details = videoMap.get(videoId);
    if (!details) continue;

    const snippet = details.snippet || rawItem.snippet;
    const contentDetails = details.contentDetails;
    const status = details.status;

    // Validate video
    if (!isPlayableSongVideo(snippet, contentDetails, status)) {
      continue;
    }

    const { title: cleanTitle, artist: cleanArtist } = parseVideoTitleAndArtist(snippet.title, snippet.channelTitle);
    const durationSec = parseISO8601Duration(contentDetails?.duration);

    const thumbnails = snippet.thumbnails || {};
    const coverImage = thumbnails.maxres?.url ||
                       thumbnails.high?.url ||
                       thumbnails.medium?.url ||
                       thumbnails.default?.url ||
                       '/images/default-album.webp';

    const normalizedSong = {
      id: videoId,
      youtubeVideoId: videoId,
      title: cleanTitle,
      artist: cleanArtist,
      album: snippet.channelTitle || 'YouTube Music',
      category: categorySlug,
      coverImage: coverImage,
      duration: durationSec,
      source: 'youtube',
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      isPlayable: true
    };

    normalizedSongs.push(normalizedSong);
  }

  const result = {
    songs: normalizedSongs,
    total: normalizedSongs.length,
    page: 1,
    limit,
    nextPageToken
  };

  // Cache normalized results for 24 hours
  const ttlMs = 24 * 60 * 60 * 1000;
  if (mongoose.connection.readyState === 1 && normalizedSongs.length > 0) {
    try {
      await YouTubeCache.updateOne(
        { cacheKey },
        {
          cacheKey,
          query,
          category: categorySlug,
          results: normalizedSongs,
          nextPageToken,
          expiresAt: new Date(Date.now() + ttlMs)
        },
        { upsert: true }
      );
    } catch (cacheErr) {
      console.warn('[YOUTUBE CACHE WARN] Failed to save MongoDB cache:', cacheErr.message);
    }
  } else if (normalizedSongs.length > 0) {
    inMemoryCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + ttlMs
    });
  }

  return result;
}

/**
 * Provider interface method: searchSongs
 */
export async function searchSongs({ query = '', category = '', artist = '', page = 1, limit = 25 }) {
  let searchQuery = '';

  if (artist) {
    searchQuery = `${artist} official songs`;
  } else if (query) {
    searchQuery = `${query} Hindi songs official`;
  } else if (category && categoryQueries[category]) {
    const queries = categoryQueries[category];
    searchQuery = queries[Math.floor(Math.random() * queries.length)];
  } else {
    searchQuery = 'Bollywood Hindi hits official';
  }

  const categorySlug = category || 'for-you';
  return await searchYouTubeVideos(searchQuery, categorySlug, limit);
}

/**
 * Provider interface method: getSong (by YouTube Video ID)
 */
export async function getSong(id) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not defined in server environment.');
  }

  const videoDetailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videoDetailsUrl.searchParams.append('part', 'snippet,contentDetails,status');
  videoDetailsUrl.searchParams.append('id', id);
  videoDetailsUrl.searchParams.append('key', apiKey);

  const res = await fetch(videoDetailsUrl.toString());
  if (!res.ok) {
    throw new Error(`YouTube API getSong failed (${res.status})`);
  }

  const data = await res.json();
  const details = data.items?.[0];

  if (!details) {
    return null;
  }

  const snippet = details.snippet;
  const contentDetails = details.contentDetails;
  const status = details.status;

  if (status && status.embeddable === false) {
    return { id, youtubeVideoId: id, isPlayable: false };
  }

  const { title: cleanTitle, artist: cleanArtist } = parseVideoTitleAndArtist(snippet.title, snippet.channelTitle);
  const durationSec = parseISO8601Duration(contentDetails?.duration);
  const thumbnails = snippet.thumbnails || {};
  const coverImage = thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '/images/default-album.webp';

  return {
    id: details.id,
    youtubeVideoId: details.id,
    title: cleanTitle,
    artist: cleanArtist,
    album: snippet.channelTitle || 'YouTube Music',
    category: 'for-you',
    coverImage,
    duration: durationSec,
    source: 'youtube',
    youtubeUrl: `https://www.youtube.com/watch?v=${details.id}`,
    isPlayable: true
  };
}

/**
 * Provider interface method: searchArtist
 */
export async function searchArtist(artistName, limit = 25) {
  return await searchSongs({ artist: artistName, limit });
}

/**
 * Provider interface method: getCategories
 */
export function getCategories() {
  return Object.keys(categoryQueries);
}

export default {
  searchSongs,
  searchArtist,
  getSong,
  getCategories
};
