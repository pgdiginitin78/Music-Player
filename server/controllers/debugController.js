import { getSong as getYouTubeSong } from '../services/providers/youtubeProvider.js';

export const debugAudioSource = async (req, res) => {
  try {
    const { id } = req.query;
    const trackId = id || req.query.trackId || 'dQw4w9WgXcQ';

    const track = await getYouTubeSong(trackId);
    if (!track) {
      return res.status(404).json({
        error: 'TRACK_NOT_FOUND',
        message: `No YouTube track found for video ID: ${trackId}`
      });
    }

    const diagnosticReport = {
      trackId: track.id,
      youtubeVideoId: track.youtubeVideoId,
      title: track.title,
      artist: track.artist,
      category: track.category,
      coverImage: track.coverImage,
      duration: track.duration,
      isPlayable: track.isPlayable,
      playbackMethod: 'youtube_iframe',
      source: 'youtube',
      youtubeUrl: track.youtubeUrl
    };

    return res.status(200).json(diagnosticReport);
  } catch (error) {
    console.error('Diagnostic error:', error.message);
    return res.status(500).json({
      error: 'DIAGNOSTIC_FAILED',
      message: error.message
    });
  }
};
