/**
 * Modular Music Provider Engine - Official YouTube Data API Integration
 * Manages YouTube provider catalog operations, capability checking, category mapping,
 * and normalized video metadata for official YouTube player streaming.
 */

import youtubeProvider from './youtubeProvider.js';

// Provider Capabilities
export const checkProviderCapabilities = () => {
  return {
    providerName: 'YouTube Data API v3 Music Provider',
    supportsFullTrackPlayback: true,
    supportsHighQuality: true,
    supportedQualityLabel: 'Official YouTube playback',
    supportedCategories: [
      'for-you',
      'bollywood-hits',
      'latest-hindi',
      'trending-hindi',
      'romantic-hindi',
      'sad-hindi',
      'lo-fi-hindi',
      'old-hindi',
      'party-hindi',
      'workout-hindi',
      'rain-hindi',
      'acoustic-hindi',
      'indie-hindi'
    ],
    supportsArtistSearch: true,
    supportsPagination: true
  };
};

/**
 * Normalizes category slug string to consistent format
 */
export const normalizeCategorySlug = (slug) => {
  if (!slug) return '';
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

/**
 * Searches provider catalog with category, artist, query, and pagination parameters.
 * Resolves verified embeddable YouTube video metadata.
 */
export const fetchTracksFromProvider = async ({
  query = '',
  category = '',
  artist = '',
  page = 1,
  limit = 30
}) => {
  const normCategory = normalizeCategorySlug(category);
  const normQuery = (query || '').trim();
  const normArtist = (artist || '').trim();

  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 25));

  // Fetch tracks from YouTube API provider
  const result = await youtubeProvider.searchSongs({
    query: normQuery,
    category: normCategory,
    artist: normArtist,
    page,
    limit: safeLimit
  });

  return {
    total: result.total || result.songs.length,
    page: 1,
    limit: safeLimit,
    totalPages: 1,
    nextPageToken: result.nextPageToken || null,
    songs: result.songs || []
  };
};
