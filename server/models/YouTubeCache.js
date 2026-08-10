import mongoose from 'mongoose';

const youtubeCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    query: { type: String, default: '' },
    category: { type: String, default: '' },
    results: { type: Array, required: true },
    nextPageToken: { type: String, default: null },
    expiresAt: { type: Date, required: true, expires: 0 } // Mongoose TTL index
  },
  { timestamps: true }
);

export default mongoose.model('YouTubeCache', youtubeCacheSchema);
