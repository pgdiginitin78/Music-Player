import mongoose from "mongoose";
import YouTubeCache from "../../models/YouTubeCache.js";

const CACHE_VERSION = "v6";

const categoryQueries = {
  "for-you": ["Hindi songs official", "Bollywood hits official"],
  "bollywood-hits": ["Bollywood Hindi hits official", "Top Bollywood songs"],
  "latest-hindi": ["Latest Hindi songs official", "New Hindi releases"],
  "trending-hindi": ["Trending Hindi songs official", "Viral Hindi songs"],
  "romantic-hindi": ["Romantic Hindi songs official", "Hindi love songs"],
  "sad-hindi": ["Sad Hindi songs official", "Heartbroken Hindi songs"],
  "lo-fi-hindi": ["Lo-Fi Hindi songs official", "Hindi lofi chill"],
  "old-hindi": ["Old Hindi Bollywood songs official", "90s Hindi classics"],
  "party-hindi": ["Party Hindi songs official", "Hindi dance tracks"],
  "workout-hindi": ["Workout Hindi songs official", "High energy Hindi music"],
  "rain-hindi": ["Rain Hindi songs official", "Monsoon Hindi melodies"],
  "acoustic-hindi": ["Acoustic Hindi songs official", "Unplugged Hindi songs"],
  "indie-hindi": ["Hindi indie songs official", "Indian indie music"],
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeSong(raw) {
  if (!raw) return null;

  const yId = raw.youtubeVideoId || raw.id || raw._id || "";
  const cleanYId =
    typeof yId === "string" && yId !== "undefined" && yId !== "null"
      ? yId.trim()
      : "";

  const rawCover = raw.coverImage || raw.thumbnail || raw.cover || "";
  let coverImage =
    typeof rawCover === "string" &&
    rawCover.trim() !== "" &&
    !rawCover.includes("undefined") &&
    !rawCover.includes("null")
      ? rawCover.trim()
      : "";

  if (!coverImage) {
    coverImage = "/images/default-album.webp";
  }

  return {
    id: cleanYId || raw.id || "",
    youtubeVideoId: cleanYId,
    title: raw.title || raw.name || "Untitled Song",
    artist: raw.artist || raw.channelTitle || "Unknown Artist",
    album: raw.album || raw.channelTitle || "YouTube Music",
    category: raw.category || "for-you",
    coverImage: coverImage,
    duration:
      typeof raw.duration === "number"
        ? raw.duration
        : parseInt(raw.duration, 10) || 210,
    source: "youtube",
    quality: raw.quality || "Official YouTube playback",
    youtubeUrl:
      raw.youtubeUrl ||
      (cleanYId ? `https://www.youtube.com/watch?v=${cleanYId}` : ""),
    isPlayable: raw.isPlayable !== false,
  };
}

const fallbackHindiSongs = [
  {
    id: "dTU413E74g0",
    youtubeVideoId: "dTU413E74g0",
    title: "Kesariya - Brahmāstra",
    artist: "Arijit Singh, Pritam, Amitabh Bhattacharya",
    album: "Brahmāstra",
    category: "romantic-hindi",
    coverImage: "/images/default-album.webp",
    duration: 268,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=dTU413E74g0",
    isPlayable: true,
  },
  {
    id: "V7LwfY5U_BU",
    youtubeVideoId: "V7LwfY5U_BU",
    title: "Apna Bana Le - Bhediya",
    artist: "Arijit Singh, Sachin-Jigar",
    album: "Bhediya",
    category: "bollywood-hits",
    coverImage: "/images/default-album.webp",
    duration: 261,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=V7LwfY5U_BU",
    isPlayable: true,
  },
  {
    id: "kY0a7L_n2i0",
    youtubeVideoId: "kY0a7L_n2i0",
    title: "Husn",
    artist: "Anuv Jain",
    album: "Husn",
    category: "indie-hindi",
    coverImage: "/images/default-album.webp",
    duration: 218,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=kY0a7L_n2i0",
    isPlayable: true,
  },
  {
    id: "NbyHNASFi6U",
    youtubeVideoId: "NbyHNASFi6U",
    title: "Chaleya - Jawan",
    artist: "Arijit Singh, Shilpa Rao, Anirudh Ravichander",
    album: "Jawan",
    category: "trending-hindi",
    coverImage: "/images/default-album.webp",
    duration: 200,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=NbyHNASFi6U",
    isPlayable: true,
  },
  {
    id: "A66TYFzyJtU",
    youtubeVideoId: "A66TYFzyJtU",
    title: "Tum Se - Teri Baaton Mein Aisa Uljha Jiya",
    artist: "Sachin-Jigar, Raghav Chaitanya",
    album: "TBMAUJ",
    category: "latest-hindi",
    coverImage: "/images/default-album.webp",
    duration: 264,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=A66TYFzyJtU",
    isPlayable: true,
  },
  {
    id: "2qZ_m9953i0",
    youtubeVideoId: "2qZ_m9953i0",
    title: "O Maahi - Dunki",
    artist: "Arijit Singh, Pritam",
    album: "Dunki",
    category: "for-you",
    coverImage: "/images/default-album.webp",
    duration: 233,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=2qZ_m9953i0",
    isPlayable: true,
  },
  {
    id: "gVyR56wZ0v8",
    youtubeVideoId: "gVyR56wZ0v8",
    title: "Tum Hi Ho - Aashiqui 2",
    artist: "Arijit Singh, Mithoon",
    album: "Aashiqui 2",
    category: "sad-hindi",
    coverImage: "/images/default-album.webp",
    duration: 262,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=gVyR56wZ0v8",
    isPlayable: true,
  },
  {
    id: "f6vY6t0_d6U",
    youtubeVideoId: "f6vY6t0_d6U",
    title: "Pehle Bhi Main - Animal",
    artist: "Vishal Mishra, Raj Shekhar",
    album: "Animal",
    category: "lo-fi-hindi",
    coverImage: "/images/default-album.webp",
    duration: 261,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=f6vY6t0_d6U",
    isPlayable: true,
  },
  {
    id: "TFr6G5zveS8",
    youtubeVideoId: "TFr6G5zveS8",
    title: "Lag Jaa Gale - Woh Kaun Thi",
    artist: "Lata Mangeshkar",
    album: "Retro Gold",
    category: "old-hindi",
    coverImage: "/images/default-album.webp",
    duration: 255,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=TFr6G5zveS8",
    isPlayable: true,
  },
  {
    id: "qFknatn-dG0",
    youtubeVideoId: "qFknatn-dG0",
    title: "Ghungroo - War",
    artist: "Arijit Singh, Shilpa Rao",
    album: "War",
    category: "party-hindi",
    coverImage: "/images/default-album.webp",
    duration: 302,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=qFknatn-dG0",
    isPlayable: true,
  },
  {
    id: "eK9j8A_w2wY",
    youtubeVideoId: "eK9j8A_w2wY",
    title: "Zinda - Bhaag Milkha Bhaag",
    artist: "Siddharth Mahadevan",
    album: "Bhaag Milkha Bhaag",
    category: "workout-hindi",
    coverImage: "/images/default-album.webp",
    duration: 211,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=eK9j8A_w2wY",
    isPlayable: true,
  },
  {
    id: "BBAyR4n0p-g",
    youtubeVideoId: "BBAyR4n0p-g",
    title: "Baarishein",
    artist: "Anuv Jain",
    album: "Baarishein",
    category: "rain-hindi",
    coverImage: "/images/default-album.webp",
    duration: 207,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=BBAyR4n0p-g",
    isPlayable: true,
  },
  {
    id: "0G483N8jYw0",
    youtubeVideoId: "0G483N8jYw0",
    title: "Cold/Mess - Acoustic",
    artist: "Prateek Kuhad",
    album: "Acoustic Hits",
    category: "acoustic-hindi",
    coverImage: "/images/default-album.webp",
    duration: 240,
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=0G483N8jYw0",
    isPlayable: true,
  },
];

function pickThumbnail(thumbnails) {
  if (!thumbnails) return "/images/default-album.webp";

  const sizes = ["maxres", "standard", "high", "medium", "default"];

  for (const size of sizes) {
    const url = thumbnails[size]?.url;
    if (url) {
      return url;
    }
  }

  return "/images/default-album.webp";
}

const inMemoryCache = new Map();

export function parseISO8601Duration(isoDuration) {
  if (!isoDuration || typeof isoDuration !== "string") return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseVideoTitleAndArtist(title, channelTitle) {
  let cleanTitle = (title || "")
    .replace(/\(Official Video\)/gi, "")
    .replace(/\[Official Video\]/gi, "")
    .replace(/\(Official Music Video\)/gi, "")
    .replace(/\[Official Music Video\]/gi, "")
    .replace(/\(Audio\)/gi, "")
    .replace(/\[Audio\]/gi, "")
    .replace(/\(Lyrical\)/gi, "")
    .replace(/\[Lyrical\]/gi, "")
    .replace(/ Full Video/gi, "")
    .replace(/ Official Song/gi, "")
    .replace(/ HD/gi, "")
    .replace(/ 4K/gi, "")
    .trim();

  let artist = channelTitle
    ? channelTitle.replace(/VEVO|Official|Music|Records|Series|TV/gi, "").trim()
    : "Hindi Artist";

  if (cleanTitle.includes("-")) {
    const parts = cleanTitle.split("-");
    if (parts.length >= 2) {
      const firstPart = parts[0].trim();
      const secondPart = parts.slice(1).join("-").trim();
      if (firstPart.length > 0 && secondPart.length > 0) {
        cleanTitle = firstPart;
        artist = secondPart;
      }
    }
  }

  if (!artist || artist.length < 2) {
    artist = channelTitle || "Hindi Artist";
  }

  return { title: cleanTitle, artist };
}

function isPlayableSongVideo(snippet, contentDetails, status) {
  if (status) {
    if (status.embeddable !== true) return false;
    if (status.privacyStatus && status.privacyStatus !== "public") return false;
    if (status.uploadStatus && status.uploadStatus !== "processed")
      return false;
  }

  const durationSec = parseISO8601Duration(contentDetails?.duration);
  if (durationSec < 50 || durationSec > 1500) {
    return false;
  }

  const titleLower = (snippet.title || "").toLowerCase();
  const descLower = (snippet.description || "").toLowerCase();
  const combined = titleLower + " " + descLower;

  const rejectedKeywords = [
    "karaoke",
    "instrumental",
    "backing track",
    "reaction",
    "tutorial",
    "cover by",
    "shorts",
    "#shorts",
    "slowed+reverb",
    "slowed and reverb",
    "slowed reverb",
    "8d audio",
    "teaser",
    "trailer",
    "making of",
    "behind the scenes",
  ];

  for (const kw of rejectedKeywords) {
    if (combined.includes(kw)) {
      return false;
    }
  }

  return true;
}

function getFallbackSongsForCategory(categorySlug = "for-you") {
  if (
    !categorySlug ||
    categorySlug === "for-you" ||
    categorySlug === "default"
  ) {
    return fallbackHindiSongs.map((s) =>
      normalizeSong({ ...s, category: "for-you" }),
    );
  }

  const matched = fallbackHindiSongs.filter((s) => s.category === categorySlug);
  if (matched.length > 0) {
    return matched.map((s) => normalizeSong(s));
  }

  return fallbackHindiSongs.map((s) =>
    normalizeSong({ ...s, category: categorySlug }),
  );
}

export async function searchYouTubeVideos(
  query,
  categorySlug = "for-you",
  limit = Infinity,
  pageToken = "",
) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      "[YOUTUBE WARN] YOUTUBE_API_KEY is not defined in environment. Returning fallback catalog.",
    );
    const fallbackList = getFallbackSongsForCategory(categorySlug);
    return {
      songs: fallbackList,
      total: fallbackList.length,
      page: 1,
      limit,
      nextPageToken: null,
    };
  }

  const cacheKey = `yt:${CACHE_VERSION}:${categorySlug}:${query}:${limit}:${pageToken}`;

  if (mongoose.connection.readyState === 1) {
    try {
      const cached = await YouTubeCache.findOne({
        cacheKey,
        expiresAt: { $gt: new Date() },
      });
      if (cached && cached.results && cached.results.length > 0) {
        const normalized = cached.results.map(normalizeSong).filter(Boolean);
        return {
          songs: normalized,
          total: normalized.length,
          page: 1,
          limit,
          nextPageToken: cached.nextPageToken || null,
        };
      }
    } catch (err) {
      console.warn("[YOUTUBE CACHE WARN]", err.message);
    }
  } else if (inMemoryCache.has(cacheKey)) {
    const cached = inMemoryCache.get(cacheKey);
    if (cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  try {
    const normalizedSongs = [];
    let currentToken = pageToken;
    let pagesFetched = 0;
    const maxPages = limit > 50 ? 5 : 1;
    const targetSongCount = limit === Infinity ? 60 : limit;
    let nextTokenToReturn = null;

    while (
      normalizedSongs.length < targetSongCount &&
      pagesFetched < maxPages
    ) {
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.append("part", "snippet");
      searchUrl.searchParams.append("type", "video");
      searchUrl.searchParams.append("videoCategoryId", "10");
      searchUrl.searchParams.append("q", query);
      searchUrl.searchParams.append(
        "maxResults",
        String(
          Math.min(
            Math.max(targetSongCount - normalizedSongs.length, 1) + 15,
            50,
          ),
        ),
      );
      searchUrl.searchParams.append("key", apiKey);
      if (currentToken) {
        searchUrl.searchParams.append("pageToken", currentToken);
      }

      let searchRes = await fetchWithTimeout(searchUrl.toString());
      if (!searchRes.ok) {
        searchUrl.searchParams.delete("videoCategoryId");
        searchRes = await fetchWithTimeout(searchUrl.toString());
        if (!searchRes.ok) {
          throw new Error(`YouTube API search status ${searchRes.status}`);
        }
      }

      const searchData = await searchRes.json();
      const rawItems = searchData.items || [];
      const nextPageToken = searchData.nextPageToken || null;
      nextTokenToReturn = nextPageToken;
      pagesFetched++;

      if (rawItems.length === 0) {
        break;
      }

      const videoIds = rawItems.map((item) => item.id?.videoId).filter(Boolean);
      if (videoIds.length === 0) {
        currentToken = nextPageToken;
        if (!currentToken) break;
        continue;
      }

      const videoDetailsUrl = new URL(
        "https://www.googleapis.com/youtube/v3/videos",
      );
      videoDetailsUrl.searchParams.append(
        "part",
        "snippet,contentDetails,status",
      );
      videoDetailsUrl.searchParams.append("id", videoIds.join(","));
      videoDetailsUrl.searchParams.append("key", apiKey);

      const videoDetailsRes = await fetchWithTimeout(
        videoDetailsUrl.toString(),
      );
      if (!videoDetailsRes.ok) {
        throw new Error(
          `YouTube API videos.list status ${videoDetailsRes.status}`,
        );
      }

      const videoDetailsData = await videoDetailsRes.json();
      const videoMap = new Map(
        (videoDetailsData.items || []).map((v) => [v.id, v]),
      );

      for (const rawItem of rawItems) {
        const videoId = rawItem.id?.videoId;
        if (!videoId) continue;

        const details = videoMap.get(videoId);
        if (!details) continue;

        const snippet = details.snippet || rawItem.snippet;
        const contentDetails = details.contentDetails;
        const status = details.status;

        if (!isPlayableSongVideo(snippet, contentDetails, status)) {
          continue;
        }

        const { title: cleanTitle, artist: cleanArtist } =
          parseVideoTitleAndArtist(snippet.title, snippet.channelTitle);
        const durationSec = parseISO8601Duration(contentDetails?.duration);
        const coverImage = pickThumbnail(snippet.thumbnails);

        const songObj = normalizeSong({
          id: videoId,
          youtubeVideoId: videoId,
          title: cleanTitle,
          artist: cleanArtist,
          album: snippet.channelTitle || "YouTube Music",
          category: categorySlug,
          coverImage: coverImage,
          duration: durationSec,
          source: "youtube",
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          isPlayable: true,
        });

        if (songObj && !normalizedSongs.some((s) => s.id === songObj.id)) {
          normalizedSongs.push(songObj);
        }
      }

      if (!nextPageToken) break;
      currentToken = nextPageToken;
    }

    let finalSongs =
      normalizedSongs.length > 0
        ? normalizedSongs
        : getFallbackSongsForCategory(categorySlug);
    if (finalSongs.length > targetSongCount) {
      finalSongs = finalSongs.slice(0, targetSongCount);
    }

    const result = {
      songs: finalSongs,
      total: finalSongs.length,
      page: 1,
      limit,
      nextPageToken: nextTokenToReturn,
    };

    const ttlMs = 24 * 60 * 60 * 1000;
    if (mongoose.connection.readyState === 1) {
      try {
        await YouTubeCache.updateOne(
          { cacheKey },
          {
            cacheKey,
            query,
            category: categorySlug,
            results: finalSongs,
            nextPageToken: nextTokenToReturn,
            expiresAt: new Date(Date.now() + ttlMs),
          },
          { upsert: true },
        );
      } catch (e) {}
    } else {
      inMemoryCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + ttlMs,
      });
    }

    return result;
  } catch (err) {
    console.warn(
      "[YOUTUBE FETCH ERROR]",
      err.message,
      "- Using fallback music list.",
    );
    const fallbackList = getFallbackSongsForCategory(categorySlug);
    return {
      songs: fallbackList,
      total: fallbackList.length,
      page: 1,
      limit,
      nextPageToken: null,
    };
  }
}

export async function searchSongs({
  query = "",
  category = "",
  artist = "",
  pageToken = "",
  limit = Infinity,
}) {
  const categorySlug = category || "for-you";

  if (artist) {
    return await searchYouTubeVideos(
      `${artist} official songs`,
      categorySlug,
      limit,
      pageToken,
    );
  } else if (query) {
    return await searchYouTubeVideos(
      `${query} Hindi songs official`,
      categorySlug,
      limit,
      pageToken,
    );
  } else {
    const queries = categoryQueries[categorySlug] || [
      "Bollywood Hindi hits official",
    ];

    if (limit > 50 && queries.length > 1) {
      const halfLimit = Math.ceil(limit / queries.length);
      const results = await Promise.all(
        queries.map((q) =>
          searchYouTubeVideos(q, categorySlug, halfLimit, pageToken),
        ),
      );

      const combinedSongs = [];
      const seenIds = new Set();

      for (const res of results) {
        for (const song of res.songs) {
          if (!seenIds.has(song.id)) {
            seenIds.add(song.id);
            combinedSongs.push(song);
          }
        }
      }

      return {
        songs: combinedSongs.slice(0, limit),
        total: combinedSongs.length,
        page: 1,
        limit,
        nextPageToken: results[0]?.nextPageToken || null,
      };
    } else {
      return await searchYouTubeVideos(
        queries[0],
        categorySlug,
        limit,
        pageToken,
      );
    }
  }
}

export async function getSong(id) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    const found = fallbackHindiSongs.find(
      (s) => s.id === id || s.youtubeVideoId === id,
    );
    if (found) return normalizeSong(found);
    return normalizeSong({
      id,
      youtubeVideoId: id,
      title: "YouTube Video",
      artist: "YouTube Artist",
      album: "YouTube Music",
      category: "for-you",
      coverImage: `/images/default-album.webp`,
      duration: 240,
      source: "youtube",
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
      isPlayable: true,
    });
  }

  try {
    const videoDetailsUrl = new URL(
      "https://www.googleapis.com/youtube/v3/videos",
    );
    videoDetailsUrl.searchParams.append(
      "part",
      "snippet,contentDetails,status",
    );
    videoDetailsUrl.searchParams.append("id", id);
    videoDetailsUrl.searchParams.append("key", apiKey);

    const res = await fetchWithTimeout(videoDetailsUrl.toString());
    if (!res.ok) {
      throw new Error(`YouTube API status ${res.status}`);
    }

    const data = await res.json();
    const details = data.items?.[0];

    if (!details) {
      const found = fallbackHindiSongs.find(
        (s) => s.id === id || s.youtubeVideoId === id,
      );
      if (found) return normalizeSong(found);
      return null;
    }

    const snippet = details.snippet;
    const contentDetails = details.contentDetails;
    const status = details.status;

    if (status && status.embeddable !== true) {
      return normalizeSong({ id, youtubeVideoId: id, isPlayable: false });
    }

    const { title: cleanTitle, artist: cleanArtist } = parseVideoTitleAndArtist(
      snippet.title,
      snippet.channelTitle,
    );
    const durationSec = parseISO8601Duration(contentDetails?.duration);
    const coverImage = pickThumbnail(snippet.thumbnails);

    return normalizeSong({
      id: details.id,
      youtubeVideoId: details.id,
      title: cleanTitle,
      artist: cleanArtist,
      album: snippet.channelTitle || "YouTube Music",
      category: "for-you",
      coverImage,
      duration: durationSec,
      source: "youtube",
      youtubeUrl: `https://www.youtube.com/watch?v=${details.id}`,
      isPlayable: true,
    });
  } catch (err) {
    const found = fallbackHindiSongs.find(
      (s) => s.id === id || s.youtubeVideoId === id,
    );
    if (found) return normalizeSong(found);
    return normalizeSong({
      id,
      youtubeVideoId: id,
      title: "YouTube Video",
      artist: "YouTube Artist",
      album: "YouTube Music",
      category: "for-you",
      coverImage: `/images/default-album.webp`,
      duration: 240,
      source: "youtube",
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
      isPlayable: true,
    });
  }
}

export async function searchArtist(artistName, limit = Infinity) {
  return await searchSongs({ artist: artistName, limit });
}

export function getCategories() {
  return Object.keys(categoryQueries);
}

export default {
  searchSongs,
  searchArtist,
  getSong,
  getCategories,
  normalizeSong,
};
