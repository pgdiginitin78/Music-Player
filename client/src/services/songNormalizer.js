const BLOCKED_ARTIST_CHANNELS = new Set([
  't-series', 'tseries', 'sony music india', 'zee music company', 'saregama music',
  'tips official', 'eros now music', 'yrf', 'dharmatic entertainment',
  'universal music india', 'warner music india', 'junglee music',
  'speed records', 'desi music factory', 'vyrl originals',
]);

function isLabelChannel(name = '') {
  return BLOCKED_ARTIST_CHANNELS.has(name.toLowerCase().trim());
}

export function normalizeSong(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const yId = raw.youtubeVideoId || raw.id || raw._id || '';
  const cleanYId = (typeof yId === 'string' && yId !== 'undefined' && yId !== 'null') ? yId.trim() : '';

  const rawCover = raw.coverImage || raw.thumbnail || raw.cover || '';
  let coverImage = (typeof rawCover === 'string' && rawCover.trim() !== '' && !rawCover.includes('undefined') && !rawCover.includes('null')) ? rawCover.trim() : '';

  if (!coverImage) {
    coverImage = '/images/default-album.webp';
  }

  const trueArtist = (raw.artist || '').trim();
  const channelTitle = (raw.channelTitle || '').trim();
  const resolvedArtist = trueArtist || (channelTitle && !isLabelChannel(channelTitle) ? channelTitle : '') || 'Unknown Artist';

  return {
    id: cleanYId || raw.id || '',
    youtubeVideoId: cleanYId,
    title: raw.title || raw.name || 'Untitled Track',
    artist: resolvedArtist,
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

export function getSongThumbnail(song) {
  if (!song) return "/images/default-album.webp";

  const cover = song.coverImage || song.thumbnail || song.cover;
  if (cover && typeof cover === 'string' && cover.trim() !== '' && !cover.includes('undefined') && !cover.includes('null')) {
    return cover.trim();
  }

  return "/images/default-album.webp";
}