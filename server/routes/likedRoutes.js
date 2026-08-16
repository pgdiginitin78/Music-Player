import { Router } from 'express';
import LikedSong from '../models/LikedSong.js';
import userContextMiddleware from '../middleware/userContext.js';
import mongoose from 'mongoose';

const router = Router();
router.use(userContextMiddleware);

// In-memory fallback if MongoDB connection is unavailable
const memoryLikedSongs = new Map();

/**
 * GET /api/liked
 * Returns liked songs scoped strictly to current device macAddress
 */
router.get('/', async (req, res) => {
  const { macAddress, userId } = req.userContext;

  try {
    if (mongoose.connection.readyState === 1) {
      const likedDocs = await LikedSong.find({ macAddress }).sort({ createdAt: -1 }).lean();

      return res.status(200).json({
        success: true,
        source: 'mongodb',
        macAddress,
        userId,
        songs: likedDocs.map((doc) => ({
          id: doc.youtubeVideoId,
          youtubeVideoId: doc.youtubeVideoId,
          songId: doc.youtubeVideoId,
          title: doc.title,
          artist: doc.artist,
          album: doc.album,
          coverImage: doc.coverImage,
          duration: doc.duration,
          category: doc.category,
          liked: true,
          likedAt: doc.createdAt,
        })),
      });
    } else {
      const deviceList = memoryLikedSongs.get(macAddress) || memoryLikedSongs.get(userId) || [];
      return res.status(200).json({
        success: true,
        source: 'memory',
        macAddress,
        userId,
        songs: deviceList,
      });
    }
  } catch (err) {
    console.error('[LIKED API GET ERROR]', err.message);
    return res.status(500).json({ success: false, songs: [], error: err.message });
  }
});

/**
 * POST /api/liked
 * Saves a song scoped strictly to current device macAddress & userId
 */
router.post('/', async (req, res) => {
  const { macAddress, userId } = req.userContext;
  const { song } = req.body;

  if (!song) {
    return res.status(400).json({ success: false, message: 'Song data required' });
  }

  const songId = song.youtubeVideoId || song.id || song._id;
  if (!songId) {
    return res.status(400).json({ success: false, message: 'Invalid song ID' });
  }

  try {
    const songData = {
      macAddress,
      userId,
      youtubeVideoId: songId,
      songId: songId,
      title: song.title || 'Untitled Track',
      artist: song.artist || 'Unknown Artist',
      album: song.album || '',
      coverImage: song.coverImage || song.thumbnail || '',
      duration: song.duration || 0,
      category: song.category || '',
      liked: true,
    };

    if (mongoose.connection.readyState === 1) {
      const updatedDoc = await LikedSong.findOneAndUpdate(
        { macAddress, youtubeVideoId: songId },
        songData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      return res.status(200).json({
        success: true,
        source: 'mongodb',
        macAddress,
        song: {
          id: updatedDoc.youtubeVideoId,
          youtubeVideoId: updatedDoc.youtubeVideoId,
          songId: updatedDoc.youtubeVideoId,
          title: updatedDoc.title,
          artist: updatedDoc.artist,
          album: updatedDoc.album,
          coverImage: updatedDoc.coverImage,
          duration: updatedDoc.duration,
          liked: true,
        },
      });
    } else {
      let list = memoryLikedSongs.get(macAddress) || [];
      if (!list.some((s) => s.youtubeVideoId === songId)) {
        list = [songData, ...list];
        memoryLikedSongs.set(macAddress, list);
      }
      return res.status(200).json({ success: true, source: 'memory', macAddress, song: songData });
    }
  } catch (err) {
    console.error('[LIKED API POST ERROR]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/liked/:songId
 * Removes a song scoped strictly to current device macAddress & userId
 */
router.delete('/:songId', async (req, res) => {
  const { macAddress, userId } = req.userContext;
  const { songId } = req.params;

  try {
    if (mongoose.connection.readyState === 1) {
      await LikedSong.deleteOne({ macAddress, youtubeVideoId: songId });
      return res.status(200).json({ success: true, source: 'mongodb', macAddress, deletedId: songId });
    } else {
      let list = memoryLikedSongs.get(macAddress) || [];
      list = list.filter((s) => s.youtubeVideoId !== songId && s.id !== songId);
      memoryLikedSongs.set(macAddress, list);
      return res.status(200).json({ success: true, source: 'memory', macAddress, deletedId: songId });
    }
  } catch (err) {
    console.error('[LIKED API DELETE ERROR]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
