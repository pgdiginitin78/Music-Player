import mongoose from 'mongoose';

const PulseEventSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    deviceId: { type: String, default: 'device_default', index: true },
    youtubeVideoId: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    artist: { type: String, default: '' },
    category: { type: String, default: '' },
    eventType: {
      type: String,
      enum: ['play', 'skip', 'complete', 'replay', 'like', 'unlike', 'search', 'playlist_add'],
      required: true,
    },
    durationPlayedSec: { type: Number, default: 0 },
    totalSongDurationSec: { type: Number, default: 210 },
    completionRatio: { type: Number, default: 0.0 },
    skipped: { type: Boolean, default: false },
    timeOfDay: { type: String, default: 'evening' }, // morning, afternoon, evening, night
    dayOfWeek: { type: Number, default: 0 }, // 0=Sunday
  },
  { timestamps: true }
);

PulseEventSchema.index({ userId: 1, createdAt: -1 });
PulseEventSchema.index({ userId: 1, youtubeVideoId: 1 });

export default mongoose.models.PulseEvent ||
  mongoose.model('PulseEvent', PulseEventSchema);
