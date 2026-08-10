import mongoose from 'mongoose';

const songSchema = new mongoose.Schema(
  {
    youtubeVideoId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album: { type: String, default: 'YouTube Music' },
    category: { type: String, required: true, index: true },
    coverImage: { type: String, required: true },
    duration: { type: Number, required: true }, // duration in seconds
    source: { type: String, default: 'youtube' },
    youtubeUrl: { type: String, required: true },
    isPlayable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model('Song', songSchema);
