/**
 * PARO Exact Song Matching & Verification Engine
 * Enforces strict priority for explicit song requests over recommendation algorithms & popularity.
 */

// Terms that indicate non-original versions unless explicitly requested
const NON_ORIGINAL_KEYWORDS = [
  'cover', 'remix', 'reverbed', 'slowed', 'lofi', 'lo-fi',
  'karaoke', 'instrumental', 'live', 'tribute', 'acoustic',
  'teaser', 'trailer', 'short', 'shorts', 'snippet', 'clip'
];

/**
 * Normalizes title/artist string by stripping punctuation, capitalization, and apostrophes.
 * Preserves core title words (does NOT strip version keywords so penalty check is accurate).
 */
export function normalizeText(text = '') {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/['’`]/g, '')        // Remove apostrophes
    .replace(/&/g, 'and')          // Normalize & to and
    .replace(/[^\w\s]/gi, ' ')     // Remove punctuation
    .replace(/\s+/g, ' ')          // Collapse spaces
    .trim();
}

/**
 * Calculates Levenshtein Distance similarity ratio between 0.0 and 1.0.
 */
export function getSimilarityRatio(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return Math.min(0.95, minLen / maxLen + 0.3);
  }

  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Extracts explicit song title and artist from natural language prompt.
 * e.g., "Play Believer by Imagine Dragons", "Play Kesariya", "Play Tum Hi Ho by Arijit Singh"
 */
export function extractExactSongRequest(message = '') {
  if (!message || typeof message !== 'string') return null;

  const raw = message.trim();

  // Exclude general mood, genre, discovery, or control prompts
  const generalKeywords = [
    'something', 'music', 'songs', 'relaxing', 'chill', 'sad', 'romantic',
    'happy', 'trending', 'viral', 'new', 'latest', 'fresh', 'popular',
    'workout', 'party', 'lofi', 'pause', 'stop', 'skip', 'next', 'previous'
  ];

  // Match pattern: "... play [song title] (by [artist])?"
  const playPatterns = [
    /(?:paro,?\s*)?(?:can you\s+)?(?:please\s+)?(?:play|put on|start|listen to)\s+(?:the song\s+|that song\s+)?(.+)/i,
    /^play\s+(.+)/i,
  ];

  let extractedTitle = null;
  let extractedArtist = null;

  for (const pattern of playPatterns) {
    const match = raw.match(pattern);
    if (match && match[1]) {
      let phrase = match[1].trim();

      const byMatch = phrase.match(/(.+?)\s+(?:by|from|singing|singer)\s+(.+)/i);
      if (byMatch) {
        extractedTitle = byMatch[1].trim();
        extractedArtist = byMatch[2].trim();
      } else {
        extractedTitle = phrase;
      }
      break;
    }
  }

  if (!extractedTitle) return null;

  // Strip command prefix words: "song", "the song", "a song", "that song", "track", "the track", "music"
  extractedTitle = extractedTitle
    .replace(/^(?:the\s+|that\s+|a\s+)?(?:song|track|music)\s+/i, '')
    .replace(/[\?\.\!]$/, '')
    .trim();

  if (extractedArtist) {
    extractedArtist = extractedArtist.replace(/[\?\.\!]$/, '').trim();
  }

  const normTitle = normalizeText(extractedTitle);

  if (!normTitle || generalKeywords.includes(normTitle) || normTitle.length < 2) {
    return null;
  }

  if (/\b(relaxing|chill|sad|romantic|happy|trending|viral|new|workout|party|lofi)\b/.test(normTitle) &&
      /\b(music|songs|tracks|hits)\b/.test(normTitle)) {
    return null;
  }

  return {
    isExactSongRequest: true,
    songTitle: extractedTitle,
    songArtist: extractedArtist,
  };
}

/**
 * Reusable Song Matcher with Priority Scoring & Penalty Filters.
 *
 * Match Priority:
 * 1. Exact Title + Exact Artist (150 pts)
 * 2. Exact Title + Artist Normalized Match (120 pts)
 * 3. Exact Title (100 pts)
 * 4. Strong Title Match (80 pts)
 * 5. Partial Title Match (50 pts)
 *
 * Penalties:
 * - If candidate is a cover, remix, live, karaoke, slowed/reverb, or snippet, and user did NOT ask for it: -50 pts.
 * - If candidate duration < 90s: -60 pts.
 */
export function findBestSongMatch({ requestedTitle, requestedArtist = null, results = [] }) {
  if (!requestedTitle || !Array.isArray(results) || results.length === 0) {
    return { song: null, confidence: 0, matchType: 'NO_MATCH' };
  }

  const normReqTitle = normalizeText(requestedTitle);
  const normReqArtist = requestedArtist ? normalizeText(requestedArtist) : null;
  const userWantsNonOriginal = NON_ORIGINAL_KEYWORDS.some(kw => normReqTitle.includes(kw));

  let bestMatch = null;
  let highestScore = -999;
  let bestMatchType = 'NO_MATCH';

  for (const song of results) {
    if (!song || !song.title) continue;

    const normCandidateTitle = normalizeText(song.title);
    const normCandidateArtist = normalizeText(song.artist || '');
    const candidateCombined = `${normCandidateTitle} ${normCandidateArtist}`;

    let score = 0;

    // 1. Title Matching
    if (normCandidateTitle === normReqTitle) {
      score += 100;
    } else if (normCandidateTitle.includes(normReqTitle)) {
      score += 80;
    } else {
      const similarity = getSimilarityRatio(normReqTitle, normCandidateTitle);
      score += similarity * 75;
    }

    // 2. Artist Matching
    if (normReqArtist && normCandidateArtist) {
      if (normCandidateArtist.includes(normReqArtist) || normReqArtist.includes(normCandidateArtist)) {
        score += 50;
      } else {
        const artistSim = getSimilarityRatio(normReqArtist, normCandidateArtist);
        score += artistSim * 40;
      }
    }

    // 3. Non-Original Penalty Filter (Covers, Remixes, Live, Karaoke, Teasers)
    if (!userWantsNonOriginal) {
      for (const kw of NON_ORIGINAL_KEYWORDS) {
        if (candidateCombined.includes(kw)) {
          score -= 50; // Deduct heavily for unwanted covers/remixes/snippets
          break;
        }
      }
    }

    // 4. Short Clip / Preview Penalty (< 90s)
    if (song.duration && song.duration < 90) {
      score -= 60;
    }

    // Classify match
    let matchType = 'PARTIAL_TITLE';
    if (score >= 130) matchType = 'EXACT_TITLE_ARTIST';
    else if (score >= 95) matchType = 'EXACT_TITLE';
    else if (score >= 70) matchType = 'STRONG_TITLE';
    else if (score >= 40) matchType = 'PARTIAL_TITLE';
    else matchType = 'NO_MATCH';

    if (score > highestScore) {
      highestScore = score;
      bestMatch = song;
      bestMatchType = matchType;
    }
  }

  const confidence = Math.min(1.0, Math.max(0, highestScore / 130));
  const MIN_CONFIDENCE_THRESHOLD = 0.40;

  if (highestScore < 40 || confidence < MIN_CONFIDENCE_THRESHOLD || !bestMatch) {
    return {
      song: null,
      confidence: 0,
      matchType: 'NO_MATCH',
      requestedTitle,
    };
  }

  return {
    song: bestMatch,
    confidence: Number(confidence.toFixed(2)),
    matchType: bestMatchType,
    requestedTitle,
    matchedTitle: bestMatch.title,
    matchedArtist: bestMatch.artist,
    matchedDuration: bestMatch.duration,
    playbackSource: (bestMatch.duration && bestMatch.duration >= 90) ? 'FULL_TRACK' : 'PREVIEW',
  };
}
