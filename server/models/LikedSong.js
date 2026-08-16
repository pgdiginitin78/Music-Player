import mongoose from 'mongoose';

const LikedSongSchema = new mongoose.Schema(
  {
    macAddress: { type: String, required: true, index: true },
    userId: { type: String, default: 'default_user', index: true },
    youtubeVideoId: { type: String, required: true },
    songId: { type: String }, // Alias field for compatibility
    title: { type: String, required: true },
    artist: { type: String, default: 'Unknown Artist' },
    album: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    category: { type: String, default: '' },
    liked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound Unique Indexes preventing duplicates per device / user
LikedSongSchema.index({ macAddress: 1, youtubeVideoId: 1 }, { unique: true });
LikedSongSchema.index({ userId: 1, youtubeVideoId: 1 }, { unique: true });

export default mongoose.models.LikedSong || mongoose.model('LikedSong', LikedSongSchema);
