import mongoose from 'mongoose';

const SongFeatureSchema = new mongoose.Schema(
  {
    youtubeVideoId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album: { type: String, default: '' },
    category: { type: String, default: '' },
    language: { type: String, default: 'Hindi' },
    releaseDate: { type: String, default: '' },
    tempo: { type: Number, default: 110 },
    energy: { type: Number, default: 0.65 },
    valence: { type: Number, default: 0.60 },
    danceability: { type: Number, default: 0.65 },
    acousticness: { type: Number, default: 0.30 },
    mood: { type: String, default: 'romantic' },
    globalPlayCount: { type: Number, default: 0 },
    globalRecentPlays: { type: Number, default: 0 },
    momentumScore: { type: Number, default: 0.0 },
    trendState: {
      type: String,
      enum: ['Rising', 'Trending', 'Exploding', 'Stable', 'Declining', 'Dead'],
      default: 'Stable',
    },
  },
  { timestamps: true }
);

export default mongoose.models.SongFeature ||
  mongoose.model('SongFeature', SongFeatureSchema);
