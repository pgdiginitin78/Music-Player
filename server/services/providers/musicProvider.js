import youtubeProvider from './youtubeProvider.js';

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

export const normalizeCategorySlug = (slug) => {
  if (!slug) return '';
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

export const fetchTracksFromProvider = async ({
  query = '',
  category = '',
  artist = '',
  pageToken = '',
  limit = 25
}) => {
  const normCategory = normalizeCategorySlug(category);
  const normQuery = (query || '').trim();
  const normArtist = (artist || '').trim();

  const parsedLimit = parseInt(limit, 10);
  const safeLimit = Math.min(50, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 25));

  const result = await youtubeProvider.searchSongs({
    query: normQuery,
    category: normCategory,
    artist: normArtist,
    pageToken,
    limit: safeLimit
  });

  return {
    total: result.total || result.songs.length,
    limit: safeLimit,
    nextPageToken: result.nextPageToken || null,
    hasMore: !!result.nextPageToken,
    songs: result.songs || []
  };
};