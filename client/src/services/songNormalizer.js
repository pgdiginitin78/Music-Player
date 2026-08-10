
export function normalizeSong(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const yId = raw.youtubeVideoId || raw.id || raw._id || '';
  const cleanYId = (typeof yId === 'string' && yId !== 'undefined' && yId !== 'null') ? yId.trim() : '';

  const rawCover = raw.coverImage || raw.thumbnail || raw.cover || '';
  let coverImage = (typeof rawCover === 'string' && rawCover.trim() !== '' && !rawCover.includes('undefined') && !rawCover.includes('null')) ? rawCover.trim() : '';

  if (!coverImage && cleanYId) {
    coverImage = `https://i.ytimg.com/vi/${cleanYId}/hqdefault.jpg`;
  }

  if (!coverImage) {
    coverImage = '/images/default-album.webp';
  }

  return {
    id: cleanYId || raw.id || '',
    youtubeVideoId: cleanYId,
    title: raw.title || raw.name || 'Untitled Track',
    artist: raw.artist || raw.channelTitle || 'Unknown Artist',
    album: raw.album || raw.channelTitle || 'YouTube Music',
    category: raw.category || 'for-you',
    coverImage: coverImage,
    duration: typeof raw.duration === 'number' ? raw.duration : (parseInt(raw.duration, 10) || 210),
    source: 'youtube',
    quality: raw.quality || 'Official YouTube playback',
    youtubeUrl: raw.youtubeUrl || (cleanYId ? `https://www.youtube.com/watch?v=${cleanYId}` : ''),
    isPlayable: raw.isPlayable !== false
  };
}

/**
 * Thumbnail Resolution Priority:
 * 1. song.coverImage
 * 2. YouTube thumbnail from real youtubeVideoId
 * 3. Local fallback /images/default-album.webp
 */
export function getSongThumbnail(song) {
  if (!song) return "/images/default-album.webp";

  const cover = song.coverImage || song.thumbnail || song.cover;
  if (cover && typeof cover === 'string' && cover.trim() !== '' && !cover.includes('undefined') && !cover.includes('null')) {
    return cover.trim();
  }

  const yId = song.youtubeVideoId || song.id;
  if (yId && typeof yId === 'string' && yId.trim() !== '' && yId !== 'undefined' && yId !== 'null') {
    return `https://i.ytimg.com/vi/${yId.trim()}/hqdefault.jpg`;
  }

  return "/images/default-album.webp";
}
