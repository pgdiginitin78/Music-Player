import mongoose from 'mongoose';

const UserPulseProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    artistAffinities: { type: Map, of: Number, default: {} },
    genreAffinities: { type: Map, of: Number, default: {} },
    languageAffinities: { type: Map, of: Number, default: {} },
    moodAffinities: { type: Map, of: Number, default: {} },
    preferredEnergy: { type: Number, default: 0.65 },
    preferredTempo: { type: Number, default: 110 },
    timeOfDayPreferences: {
      morning: { type: Map, of: Number, default: {} },
      afternoon: { type: Map, of: Number, default: {} },
      evening: { type: Map, of: Number, default: {} },
      night: { type: Map, of: Number, default: {} },
    },
    negativePreferences: {
      artists: [{ type: String }],
      genres: [{ type: String }],
      languages: [{ type: String }],
      moods: [{ type: String }],
    },
    discoveryProfile: {
      totalDiscovered: { type: Number, default: 0 },
      lastDiscoveryAt: { type: Date },
    },
    totalPlays: { type: Number, default: 0 },
    totalSkips: { type: Number, default: 0 },
    totalReplays: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.UserPulseProfile ||
  mongoose.model('UserPulseProfile', UserPulseProfileSchema);
