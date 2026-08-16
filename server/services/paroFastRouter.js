import { extractExactSongRequest } from './songMatcher.js';

/**
 * PARO Fast Intent Router (Level 2 Server Intent Engine)
 * Evaluates natural language commands in < 5ms without requiring Python subprocess overhead.
 */
export function parseFastIntent(message = '', playerState = {}) {
  const msgLower = String(message).toLowerCase().trim();

  // 1. Instant Player Controls (Level 1 fallback)
  if (/\b(pause|stop|hold on|pause music)\b/.test(msgLower)) {
    return { level: 1, action: 'pause', reply: 'Paused playback.' };
  }
  if (/\b(resume|play|continue|start playing)\b/.test(msgLower) && msgLower.length < 15) {
    return { level: 1, action: 'play', reply: 'Resuming playback.' };
  }
  if (/\b(skip|next|next song|skip this)\b/.test(msgLower)) {
    return { level: 1, action: 'skip', reply: 'Skipping track.' };
  }
  if (/\b(previous|go back|last song)\b/.test(msgLower)) {
    return { level: 1, action: 'previous', reply: 'Playing previous track.' };
  }

  // 2. Priority 1: Check for Explicit Song Request (e.g. "Play Ehsass", "PARO play Kesariya", "Play Tum Hi Ho")
  const exactRequest = extractExactSongRequest(message);
  if (exactRequest && exactRequest.songTitle) {
    return {
      level: 2,
      intent: 'PLAY_EXACT_SONG',
      mode: 'exact-song',
      query: exactRequest.songArtist ? `${exactRequest.songTitle} ${exactRequest.songArtist}` : exactRequest.songTitle,
      songTitle: exactRequest.songTitle,
      songArtist: exactRequest.songArtist || null,
      reply: `Sure, searching for ${exactRequest.songTitle}.`,
    };
  }

  // 3. Fast Music Intents (General Moods, Genres, Languages, Trending, New)
  const intent = {
    level: 2,
    intent: 'play_music',
    mode: 'for-you',
    query: null,
    artist: null,
    mood: null,
    language: null,
    energy: null,
    freshness: null,
    trending: false,
    similarToCurrent: false,
    reply: "I've got you. Starting music for you.",
  };

  // Trending
  if (/\b(trending|viral|popular|hottest)\b/.test(msgLower)) {
    intent.trending = true;
    intent.mode = 'trending';
    intent.reply = 'Here are top trending tracks gaining momentum right now.';
  }

  // New releases
  if (/\b(new|latest|fresh|just released)\b/.test(msgLower)) {
    intent.freshness = 'high';
    intent.mode = 'new';
    intent.reply = 'Playing fresh new release songs for you.';
  }

  // Language
  if (msgLower.includes('hindi')) intent.language = 'Hindi';
  if (msgLower.includes('punjabi')) intent.language = 'Punjabi';
  if (msgLower.includes('english')) intent.language = 'English';

  // Moods & Scenarios
  if (/\b(sad|feeling low|lonely|heartbroken)\b/.test(msgLower)) {
    intent.mood = 'sad';
    intent.energy = 'low';
    intent.reply = "I've got you. Let's keep things calm.";
  } else if (/\b(relaxing|chill|calm|peaceful|soothing)\b/.test(msgLower)) {
    intent.mood = 'relaxing';
    intent.energy = 'low';
    intent.reply = 'Playing relaxing chill tracks.';
  } else if (/\b(romantic|love)\b/.test(msgLower)) {
    intent.mood = 'romantic';
    intent.energy = 'medium';
    intent.reply = 'Starting a romantic mix for you.';
  } else if (/\b(happy|party|dance)\b/.test(msgLower)) {
    intent.mood = 'happy';
    intent.energy = 'high';
    intent.reply = 'Lifting the vibe with energetic music.';
  } else if (/\b(workout|gym|exercise)\b/.test(msgLower)) {
    intent.mood = 'workout';
    intent.energy = 'high';
    intent.reply = 'Pumping up high-energy workout tracks.';
  }

  // Energy Modifiers
  if (/\b(more energetic|higher energy|lift the vibe|faster)\b/.test(msgLower)) {
    intent.energy = 'high';
    intent.reply = 'Raising the energy level for you.';
  } else if (/\b(slower|calmer|more chill)\b/.test(msgLower)) {
    intent.energy = 'low';
    intent.reply = 'Bringing down the energy to something calmer.';
  }

  // Contextual Similarity ("songs like this")
  if (/\b(like this|similar to this|more like this)\b/.test(msgLower)) {
    intent.similarToCurrent = true;
    intent.mode = 'because-you-listened';
    if (playerState?.currentSong?.artist) {
      intent.artist = playerState.currentSong.artist;
      intent.reply = `Playing tracks similar to ${playerState.currentSong.title}.`;
    }
  }

  // Artist Matches (e.g. "play Arijit Singh")
  const artistMatch = msgLower.match(/(?:by|artist|play)\s+([a-z\s]+)/i);
  if (artistMatch) {
    const artistName = artistMatch[1].trim();
    if (!['some', 'new', 'more', 'like', 'hindi', 'romantic', 'sad', 'music'].includes(artistName)) {
      intent.artist = artistName;
      intent.query = artistName;
      intent.reply = `Playing tracks by ${artistName}.`;
    }
  }

  // Complex conversation trigger check (Level 3)
  if (/\b(why did you|explain|tell me|yesterday|history)\b/.test(msgLower)) {
    intent.level = 3;
  }

  return intent;
}
