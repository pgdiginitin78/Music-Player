import { searchSongs, getCapabilities } from '../services/musicService.js';
import { getSong as getYouTubeSong, normalizeSong } from '../services/providers/youtubeProvider.js';

export const getSongs = async (req, res, next) => {
  try {
    const { category, query, search, q, artist, page = 1, limit = Infinity } = req.query;
    
    const searchQuery = q || search || query || '';

    const result = await searchSongs({
      query: searchQuery,
      category: category || '',
      artist: artist || '',
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || Infinity
    });

    const rawSongs = result?.songs || [];
    const normalizedSongs = rawSongs.map(normalizeSong).filter(Boolean);

    // Diagnostic logging (NO SECRETS LOGGED)
    console.log('[SONGS CONTROLLER RESPONSE DIAGNOSTIC]', {
      environment: process.env.NODE_ENV || 'development',
      endpoint: '/api/songs',
      category: category || 'all',
      songCount: normalizedSongs.length,
      firstSong: normalizedSongs[0] ? {
        id: normalizedSongs[0].id,
        youtubeVideoId: normalizedSongs[0].youtubeVideoId,
        title: normalizedSongs[0].title,
        coverImage: normalizedSongs[0].coverImage
      } : null
    });

    res.setHeader('X-Total-Count', result?.total || normalizedSongs.length);
    res.setHeader('X-Page', result?.page || 1);
    res.setHeader('X-Limit', result?.limit || Infinity);

    if (req.query.paginated === 'true') {
      return res.status(200).json({
        ...result,
        songs: normalizedSongs
      });
    }

    res.status(200).json(normalizedSongs);
  } catch (error) {
    console.error('[YOUTUBE SEARCH CONTROLLER ERROR]', error.message);
    res.status(200).json([]);
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

    const rawTrack = await getYouTubeSong(id);
    const track = normalizeSong(rawTrack);
    
    if (!track) {
      return res.status(404).json({
        isPlayable: false,
        error: "PLAYBACK_UNAVAILABLE",
        message: "Playback is unavailable for this YouTube video."
      });
    }
    
    res.status(200).json(track);
  } catch (error) {
    console.error('[YOUTUBE SONG BY ID ERROR]', error.message);
    res.status(404).json({
      error: "SONG_NOT_FOUND",
      message: "Unable to find song."
    });
  }
};

export const getSongPlayback = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(404).json({
        error: "SONG_NOT_FOUND",
        message: "Song was not found."
      });
    }

    const rawTrack = await getYouTubeSong(id);
    const track = normalizeSong(rawTrack);

    const playbackInfo = {
      id: track?.id || id,
      youtubeVideoId: track?.youtubeVideoId || id,
      title: track?.title || 'YouTube Music',
      artist: track?.artist || 'YouTube Artist',
      album: track?.album || 'YouTube Music',
      isPlayable: true,
      quality: 'Official YouTube playback',
      playbackMethod: 'youtube_iframe',
      youtubeUrl: track?.youtubeUrl || `https://www.youtube.com/watch?v=${id}`
    };

    return res.status(200).json(playbackInfo);

  } catch (error) {
    console.error("[PLAYBACK INFO ERROR]", error.message);

    return res.status(200).json({
      id: req.params?.id,
      youtubeVideoId: req.params?.id,
      title: 'YouTube Music',
      artist: 'YouTube Artist',
      isPlayable: true,
      playbackMethod: 'youtube_iframe'
    });
  }
};

export const getProviderCapabilities = (req, res, next) => {
  res.status(200).json(getCapabilities());
};
