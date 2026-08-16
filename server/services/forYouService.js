/**
 * For You Recommendation Service (AI Time-Decay Algorithm)
 * Ranks today's most played songs dynamically based on user engagement.
 */

class TodayForYouService {
  constructor(halfLifeHours = 6.0) {
    this.halfLifeHours = halfLifeHours;
    this.playLogs = []; // Stores today's play events
  }

  /**
   * Record a song play event
   */
  recordPlay(songId, userId = 'anonymous', durationPlayedSec = 210, totalDurationSec = 210, skipped = false) {
    this.playLogs.push({
      songId,
      userId,
      timestamp: Date.now(),
      durationPlayedSec,
      totalDurationSec,
      skipped,
    });

    // Automatically purge logs older than 24h to keep memory lean
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.playLogs = this.playLogs.filter((e) => e.timestamp >= cutoff);
  }

  /**
   * Ranks songs for "For You" category using AI Time-Decay scoring
   */
  getRankedSongsToday(allSongs = [], topN = 25) {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    const scores = new Map();
    const userPlayCounts = new Map();
    const playTotals = new Map();
    const uniqueUsers = new Map();

    for (const event of this.playLogs) {
      // 1. Filter: Today only (since midnight)
      if (event.timestamp < todayStart) continue;

      // 2. AI Exponential Time-Decay Weighting
      const deltaHours = (now - event.timestamp) / (3600 * 1000);
      const timeWeight = Math.pow(2, -deltaHours / this.halfLifeHours);

      // 3. Play Quality & Completion Ratio
      const completionRatio = Math.min(1.0, event.durationPlayedSec / Math.max(1, event.totalDurationSec));
      const qualityMult = event.skipped ? 0.2 : 0.5 + 0.5 * completionRatio;

      // 4. Anti-Spam User Diversity (Diminishing returns per user)
      const userKey = `${event.songId}::${event.userId}`;
      const playNum = (userPlayCounts.get(userKey) || 0) + 1;
      userPlayCounts.set(userKey, playNum);
      const userDiversityFactor = 1.0 / Math.sqrt(playNum);

      // Calculate score for this play event
      const eventScore = timeWeight * qualityMult * userDiversityFactor;
      scores.set(event.songId, (scores.get(event.songId) || 0) + eventScore);

      playTotals.set(event.songId, (playTotals.get(event.songId) || 0) + 1);

      if (!uniqueUsers.has(event.songId)) uniqueUsers.set(event.songId, new Set());
      uniqueUsers.get(event.songId).add(event.userId);
    }

    if (scores.size === 0) {
      return allSongs.slice(0, topN);
    }

    const songMap = new Map(allSongs.map((s) => [s.youtubeVideoId || s.id, s]));
    const ranked = [];

    for (const [songId, score] of scores.entries()) {
      const song = songMap.get(songId);
      if (song) {
        ranked.push({
          ...song,
          score: Number(score.toFixed(4)),
          todaysPlayCount: playTotals.get(songId) || 0,
          todaysUniqueListeners: uniqueUsers.get(songId)?.size || 1,
        });
      }
    }

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    // Append remaining catalog songs if needed to fill topN
    for (const song of allSongs) {
      const id = song.youtubeVideoId || song.id;
      if (!scores.has(id) && ranked.length < topN) {
        ranked.push(song);
      }
    }

    return ranked.slice(0, topN);
  }
}

export const forYouService = new TodayForYouService();
export default forYouService;
