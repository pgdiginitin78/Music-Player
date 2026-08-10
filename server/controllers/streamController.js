// Deprecated: Stream controller removed in favor of YouTube IFrame Player API.
export const streamSongById = (req, res) => {
  res.status(410).json({ error: 'GONE', message: 'Stream controller is deprecated. Playback uses YouTube IFrame Player API.' });
};
