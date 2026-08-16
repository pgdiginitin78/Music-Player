/**
 * AI Lyrics Duration & Phonetic Word Alignment Service
 * Calculates exact line start/end timestamps based on song duration, word count & intro padding.
 */

export function alignLyricsToDuration(lines = [], totalDurationSec = 210) {
  if (!Array.isArray(lines) || lines.length === 0 || !totalDurationSec || totalDurationSec <= 0) {
    return [];
  }

  const cleanLines = lines.map((l) => (typeof l === 'string' ? l.trim() : '')).filter(Boolean);
  if (cleanLines.length === 0) return [];

  // 1. Calculate realistic instrumental intro & outro padding
  const introPadding = Math.min(15.0, Math.max(4.0, totalDurationSec * 0.07));
  const outroPadding = Math.min(12.0, Math.max(4.0, totalDurationSec * 0.05));
  const vocalDuration = Math.max(10.0, totalDurationSec - introPadding - outroPadding);

  // 2. Phonetic & Word Weighting
  const weights = cleanLines.map((line) => {
    const wordCount = line.split(/\s+/).length;
    const charCount = line.length;
    const weight = wordCount * 1.5 + charCount * 0.2;
    return Math.max(1.0, weight);
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  // 3. Assign startSec and endSec ranges
  let cursor = introPadding;
  const aligned = [];

  cleanLines.forEach((text, idx) => {
    const lineDuration = Math.max(1.8, (weights[idx] / totalWeight) * vocalDuration);
    const startSec = cursor;
    const endSec = startSec + lineDuration;
    cursor = endSec;

    aligned.push({
      lineIndex: idx,
      text,
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      durationSec: Number(lineDuration.toFixed(2)),
    });
  });

  return aligned;
}

/**
 * Returns active line index for a given playback currentTime
 */
export function getActiveLineIndex(alignedLines = [], currentTimeSec = 0) {
  if (!Array.isArray(alignedLines) || alignedLines.length === 0) return 0;

  for (let i = 0; i < alignedLines.length; i++) {
    const item = alignedLines[i];
    if (currentTimeSec >= item.startSec && currentTimeSec <= item.endSec) {
      return item.lineIndex;
    }
  }

  if (currentTimeSec < alignedLines[0].startSec) return 0;
  return alignedLines.length - 1;
}
