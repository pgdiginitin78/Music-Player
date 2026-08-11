import { getLyrics } from "./lyrics/lyricsProvider.js";

const cache = new Map();
const TTL_FOUND_MS = 30 * 60 * 1000;
const TTL_NOT_FOUND_MS = 5 * 60 * 1000;

const MAX_ATTEMPTS = 6;
const PER_CALL_TIMEOUT_MS = 3000;
const OVERALL_BUDGET_MS = 8000;

function cacheKey(artist, title) {
  return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim().replace(/\s+/g, " ")}`;
}

function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function toCache(key, result) {
  if (result.found) {
    cache.set(key, { result, expiresAt: Date.now() + TTL_FOUND_MS });
  } else if (result.reason === "not_found") {
    cache.set(key, { result, expiresAt: Date.now() + TTL_NOT_FOUND_MS });
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(
        () => resolve({ found: false, lyrics: [], reason: "timeout" }),
        ms,
      );
    }),
  ]);
}

const BLOCKED_ARTISTS = new Set([
  "t-series",
  "tseries",
  "sony music india",
  "zee music company",
  "saregama music",
  "tips official",
  "eros now music",
  "yrf",
  "dharmatic entertainment",
  "universal music india",
  "warner music india",
  "junglee music",
  "speed records",
  "desi music factory",
  "vyrl originals",
  "unknown artist",
]);

function isBlockedArtist(name) {
  if (!name) return true;
  return BLOCKED_ARTISTS.has(name.toLowerCase().trim());
}

const TITLE_PREFIX_RE =
  /^(full\s*(video|audio|song|lyric[s]?|hd|4k)|official\s*(video|audio|song|lyric[s]?|music\s*video)|lyric[s]?\s*(video|song)?|audio\s*(song|video)?|video\s*song|music\s*video|song|lyrical\s*(video)?)\s*[:\-|]?\s*/gi;

const TITLE_SUFFIX_RE =
  /\s*[\|\-]\s*(official\s*(video|audio|song|music\s*video|lyric[s]?)|full\s*(video|audio|song)|lyric[s]?\s*(video|song)?|4[kK]|hd|1080p|720p|remaster(ed)?|music\s*video|video\s*song|t[-\s]?series|sony music|zee music|saregama|tips official|eros now)\s*$/gi;

export function cleanTitle(raw = "") {
  return raw
    .replace(TITLE_PREFIX_RE, "")
    .replace(TITLE_SUFFIX_RE, "")
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s*\[.*?\]/g, "")
    .trim();
}

export function cleanArtist(raw = "") {
  return raw
    .replace(/\s*[,&]\s*.+$/g, "")
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s*\[.*?\]/g, "")
    .trim();
}

export function parseYouTubeTitle(rawTitle = "", rawArtist = "") {
  const parts = rawTitle
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  const songName = cleanTitle(parts[0] || rawTitle);
  const metaArtist = cleanArtist(rawArtist);

  if (metaArtist && metaArtist.length >= 3 && !isBlockedArtist(metaArtist)) {
    return { songName, artist: metaArtist };
  }

  const knownArtistPatterns = [
    /arijit/i,
    /anuv/i,
    /darshan raval/i,
    /armaan malik/i,
    /jubin nautiyal/i,
    /vishal mishra/i,
    /mohit chauhan/i,
    /atif aslam/i,
    /shreya ghoshal/i,
    /sunidhi chauhan/i,
    /neha kakkar/i,
    /king/i,
    /prateek kuhad/i,
    /sachet tandon/i,
    /parampara tandon/i,
    /amit trivedi/i,
    /pritam/i,
    /badshah/i,
    /yo yo honey singh/i,
    /divine/i,
    /mc stan/i,
    /seedhe maut/i,
    /javed ali/i,
    /benny dayal/i,
    /shaan/i,
    /b praak/i,
    /stebin ben/i,
    /nakash aziz/i,
    /kailash kher/i,
    /rekha bhardwaj/i,
    /shilpa rao/i,
    /mika singh/i,
    /ankit tiwari/i,
    /papon/i,
    /ajay gogavale/i,
    /atul gogavale/i,
    /avadhoot gupte/i,
    /mahesh kale/i,
    /rahul deshpande/i,
    /adarsh shinde/i,
    /anand shinde/i,
    /utkarsh shinde/i,
    /arya ambekar/i,
    /mugdha vaishampayan/i,
    /swapnil bandodkar/i,
    /vaishali samant/i,
    /bela shende/i,
    /hrishikesh ranade/i,
    /priyanka barve/i,
    /jasraj joshi/i,
    /anandi joshi/i,
    /ketaki mategaonkar/i,
  ];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const isLikelyArtist = knownArtistPatterns.some((re) => re.test(part));
    if (isLikelyArtist && !isBlockedArtist(part)) {
      const artist = part.split(",")[0].trim();
      return { songName, artist };
    }
  }

  if (parts.length >= 3) {
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts[i].split(",")[0].trim();
      if (!isBlockedArtist(candidate) && candidate.length >= 3) {
        return { songName, artist: candidate };
      }
    }
  }

  return { songName, artist: "" };
}

export async function findLyrics(rawArtist, rawTitle) {
  const { songName, artist } = parseYouTubeTitle(rawTitle, rawArtist);

  const pipeParts = (s) =>
    (s || "")
      .split("|")
      .map((p) => cleanTitle(p.trim()))
      .filter(Boolean);

  const rawAttempts = [];

  if (artist && songName) rawAttempts.push([artist, songName]);

  const ct = cleanTitle(rawTitle);
  const ca = cleanArtist(rawArtist);
  if (ca && ct && !isBlockedArtist(ca)) rawAttempts.push([ca, ct]);

  const artistPipes = pipeParts(rawArtist).filter((p) => !isBlockedArtist(p));
  const titlePipes = pipeParts(rawTitle);

  for (const ap of artistPipes) {
    const inferredArtist = artist || titlePipes[0] || "";
    if (inferredArtist && !isBlockedArtist(inferredArtist))
      rawAttempts.push([inferredArtist, ap]);
    for (const tp of titlePipes) {
      if (tp) rawAttempts.push([tp, ap]);
    }
  }

  for (const tp of titlePipes) {
    for (const ap of artistPipes) {
      if (ap) rawAttempts.push([ap, tp]);
    }
  }

  const seen = new Set();
  const attempts = rawAttempts
    .filter(([a, t]) => {
      if (!a || !t) return false;
      if (isBlockedArtist(a)) return false;
      const k = `${a.toLowerCase()}::${t.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_ATTEMPTS);

  console.log(
    `[LYRICS] Trying ${attempts.length} search combinations for rawTitle="${rawTitle}" rawArtist="${rawArtist}"`,
  );

  if (attempts.length === 0) {
    return {
      found: false,
      artist,
      title: songName,
      lyrics: [],
      source: "lyrics.ovh",
      reason: "no_valid_artist",
    };
  }

  const startTime = Date.now();
  let lastFailure = null;

  for (const [a, t] of attempts) {
    if (Date.now() - startTime > OVERALL_BUDGET_MS) {
      console.warn("[LYRICS] Overall time budget exceeded, stopping early");
      break;
    }

    const key = cacheKey(a, t);
    const cached = fromCache(key);

    if (cached) {
      console.log("[LYRICS] Cache hit for", key);
      if (cached.found) return cached;
      lastFailure = cached;
      continue;
    }

    const result = await withTimeout(getLyrics(a, t), PER_CALL_TIMEOUT_MS);

    if (result.found) {
      toCache(key, result);
      return result;
    }

    if (result.reason === "not_found") {
      toCache(key, result);
      lastFailure = result;
      continue;
    }

    console.warn(
      `[LYRICS] ${result.reason} for artist="${a}" title="${t}", trying next combination`,
    );
    lastFailure = result;
  }

  return {
    found: false,
    artist,
    title: songName,
    lyrics: [],
    source: "lyrics.ovh",
    reason: lastFailure?.reason || "not_found",
  };
}
