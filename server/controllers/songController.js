import { searchSongs, getCapabilities } from '../services/musicService.js';
import { getSong as getYouTubeSong } from '../services/providers/youtubeProvider.js';

export const getSongs = async (req, res, next) => {
  try {
    const { category, query, search, artist, page = 1, limit = 30 } = req.query;
    
    const result = await searchSongs({
      query: search || query || '',
      category: category || '',
      artist: artist || '',
      page,
      limit
    });

    res.setHeader('X-Total-Count', result.total);
    res.setHeader('X-Page', result.page);
    res.setHeader('X-Limit', result.limit);

    if (req.query.paginated === 'true') {
      return res.status(200).json(result);
    }

    res.status(200).json(result.songs);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ message: 'Error fetching songs from YouTube provider', error: error.message });
  }
};

export const getSongById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(404).json({
        error: "SONG_NOT_FOUND",
        message: "Song was not found."
      });
    }

    const track = await getYouTubeSong(id);
    
    if (!track || !track.isPlayable) {
      return res.status(404).json({
        isPlayable: false,
        error: "PLAYBACK_UNAVAILABLE",
        message: "Playback is unavailable for this YouTube video."
      });
    }
    
    res.status(200).json(track);
  } catch (error) {
    console.error('Error fetching YouTube track by ID:', error);
    res.status(500).json({ message: 'Error fetching track', error: error.message });
  }
};

/**
 * Normalized Playback Response Endpoint
 * GET /api/songs/:id/playback
 * Returns authorized YouTube playback metadata (youtubeVideoId & IFrame method).
 */
export const getSongPlayback = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      console.error('[PLAYBACK LOOKUP FAIL] Missing or invalid song ID:', id);
      return res.status(404).json({
        error: "SONG_NOT_FOUND",
        message: "Song was not found."
      });
    }

    let track = null;
    try {
      track = await getYouTubeSong(id);
    } catch (providerErr) {
      console.error('[YOUTUBE PROVIDER FETCH ERROR]', {
        songId: id,
        message: providerErr.message,
        stack: providerErr.stack
      });

      return res.status(502).json({
        error: "PROVIDER_REQUEST_FAILED",
        message: "Unable to contact YouTube Data API."
      });
    }

    if (!track || !track.isPlayable) {
      return res.status(200).json({
        id: id,
        youtubeVideoId: id,
        title: track?.title || 'Unknown Track',
        artist: track?.artist || 'Unknown Artist',
        album: track?.album || 'YouTube Music',
        isPlayable: false,
        playbackMethod: 'youtube_iframe',
        quality: "Official YouTube playback",
        error: "PLAYBACK_UNAVAILABLE",
        message: "This YouTube video cannot be embedded or played."
      });
    }

    const playbackInfo = {
      id: track.id,
      youtubeVideoId: track.youtubeVideoId,
      title: track.title,
      artist: track.artist,
      album: track.album || 'YouTube Music',
      isPlayable: true,
      quality: 'Official YouTube playback',
      playbackMethod: 'youtube_iframe',
      youtubeUrl: track.youtubeUrl
    };

    return res.status(200).json(playbackInfo);

  } catch (error) {
    console.error("[PLAYBACK INFO ERROR]", {
      songId: req.params?.id,
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: "PLAYBACK_INFO_FAILED",
      message: "Unable to retrieve playback information."
    });
  }
};

export const getProviderCapabilities = (req, res, next) => {
  res.status(200).json(getCapabilities());
};
