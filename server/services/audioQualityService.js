/**
 * Audio Quality & Stream Validation Service
 * Processes audio streams from music providers, determines actual quality,
 * filters previews vs full tracks, and selects the highest permitted stream.
 */

const PREVIEW_TITLE_KEYWORDS = [
  '30 sec preview',
  '30-second preview',
  'sample clip',
  'trailer snippet',
  'preview clip'
];

/**
 * Validates whether a track is a preview or a full playable track
 */
export const validateTrackPlayback = (trackData) => {
  // If track explicitly declares isPreview = false and playbackType = 'full', respect it!
  if (trackData.isPreview === false && trackData.playbackType === 'full') {
    return {
      isPreview: false,
      isPlayable: true,
      playbackType: 'full'
    };
  }

  const title = (trackData.title || trackData.name || '').toLowerCase();
  const rawDuration = trackData.duration || trackData.duration_seconds || 0;
  
  let isPreview = false;
  
  // Check explicit provider flags
  if (trackData.is_preview === true || trackData.isPreview === true) {
    isPreview = true;
  }

  // Check Title keywords for preview indicators
  if (PREVIEW_TITLE_KEYWORDS.some(keyword => title.includes(keyword))) {
    isPreview = true;
  }

  // Duration check: less than 45 seconds is considered a preview only if not explicitly marked full
  if (typeof rawDuration === 'number' && rawDuration > 0 && rawDuration < 45 && trackData.playbackType !== 'full') {
    isPreview = true;
  }

  // Determine playback type
  const playbackType = isPreview ? 'preview' : 'full';
  
  // Playable rules: Must have audioUrl/directUrl and not be explicitly unplayable
  const isPlayable = Boolean((trackData.audioUrl || trackData.directUrl) && trackData.isPlayable !== false);

  return {
    isPreview,
    isPlayable,
    playbackType
  };
};

/**
 * Sorts and selects the highest available audio quality stream
 * Stream Quality Hierarchy:
 * Lossless (FLAC/ALAC) > High AAC/Opus (320 kbps) > 320 kbps MP3 > 256 kbps > 192 kbps > 128 kbps
 */
export const selectHighestQualityStream = (streams = [], defaultBitrate = 320) => {
  if (!Array.isArray(streams) || streams.length === 0) {
    return {
      quality: `${defaultBitrate} kbps MP3`,
      bitrate: defaultBitrate,
      format: 'mp3'
    };
  }

  // Filter out invalid/empty streams
  const validStreams = streams.filter(s => s && s.url);
  if (validStreams.length === 0) {
    return {
      quality: `${defaultBitrate} kbps MP3`,
      bitrate: defaultBitrate,
      format: 'mp3'
    };
  }

  // Sort by bitrate descending
  validStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  const best = validStreams[0];
  const bitrate = best.bitrate || defaultBitrate;
  let qualityLabel = `${bitrate} kbps MP3`;

  if (best.format === 'flac' || best.format === 'alac' || bitrate > 320) {
    qualityLabel = 'Lossless (FLAC)';
  } else if (bitrate >= 320) {
    qualityLabel = '320 kbps MP3';
  } else if (bitrate >= 256) {
    qualityLabel = '256 kbps MP3';
  } else if (bitrate >= 192) {
    qualityLabel = '192 kbps MP3';
  } else {
    qualityLabel = `${bitrate} kbps MP3`;
  }

  return {
    audioUrl: best.url,
    quality: qualityLabel,
    bitrate: bitrate,
    format: best.format || 'mp3'
  };
};

/**
 * Normalizes provider track data with validated audio quality & playback flags
 */
export const normalizeTrackWithQuality = (track) => {
  const playbackValidation = validateTrackPlayback(track);

  const durationSec = typeof track.duration === 'number' 
    ? track.duration 
    : parseDurationToSeconds(track.duration);

  const isPlayable = Boolean(track.audioUrl && track.isPlayable !== false && playbackValidation.isPlayable);
  const trackFormat = track.format ? track.format.toLowerCase() : null;
  const formatLabel = trackFormat === 'mp4' ? 'AAC' : (trackFormat ? trackFormat.toUpperCase() : '');
  const bitrate = track.bitrate || null;
  
  let quality = track.quality || null;
  if (!quality && bitrate && formatLabel) {
    quality = `${bitrate} kbps ${formatLabel}`;
  } else if (!quality) {
    quality = 'Quality unavailable';
  }

  return {
    id: String(track.id || track._id || track.trackId),
    _id: String(track.id || track._id || track.trackId),
    title: track.title || track.trackName || 'Unknown Title',
    artist: track.artist || track.artistName || 'Unknown Artist',
    album: track.album || track.collectionName || 'Hindi Album',
    category: track.category || 'bollywood-hits',
    coverImage: track.coverImage || track.artworkUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
    audioUrl: isPlayable ? track.audioUrl : null,
    duration: durationSec,
    formattedDuration: formatSecondsToMMSS(durationSec),
    source: track.source || 'Licensed Hindi Music Provider',
    quality: quality,
    bitrate: bitrate,
    format: trackFormat,
    isPreview: playbackValidation.isPreview,
    isPlayable: isPlayable,
    playbackType: isPlayable ? playbackValidation.playbackType : null
  };
};


function parseDurationToSeconds(dur) {
  if (!dur) return 210;
  if (typeof dur === 'number') return Math.floor(dur);
  if (typeof dur === 'string' && dur.includes(':')) {
    const parts = dur.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseInt(dur, 10) || 210;
}

function formatSecondsToMMSS(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
