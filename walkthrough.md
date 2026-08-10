# Walkthrough - Migrated Music Provider from Spotify to Official YouTube APIs

Spotify music provider integration has been completely removed and replaced with **official YouTube Data API v3** for music search & discovery and **official YouTube IFrame Player API** for client playback.

Audio extraction (`yt-dlp`, `/api/songs/:id/stream`, HTML5 Audio `<audio>`) has been completely removed per YouTube Terms of Service and user requirements.

---

## Key Technical Implementation Details

### 1. Official YouTube Data API v3 Backend Provider
- **[youtubeProvider.js](file:///d:/myprojects/client/server/services/providers/youtubeProvider.js)**:
  - Configured server-side `YOUTUBE_API_KEY` stored in `server/.env`.
  - Implemented `searchSongs()` and `searchArtist()` querying `https://www.googleapis.com/youtube/v3/search` with `part=snippet`, `type=video`, `maxResults=25`.
  - Implemented video validation via `videos.list` (`part=snippet,contentDetails,status`):
    - Rejects non-embeddable videos (`status.embeddable === false`).
    - Rejects non-public/removed videos.
    - Rejects YouTube Shorts (< 50s duration) and unwanted categories (karaoke, instrumental, backing track, reactions, tutorials).
    - Parses ISO 8601 duration string (e.g. `PT3M45S` -> seconds).
  - Implemented `categoryQueryMap` for all 13 Hindi categories (Bollywood Hits, Romantic, Lo-Fi, Old Hindi, Rain, Indie, etc.).

### 2. Backend Caching & Schema Optimization
- **[YouTubeCache.js](file:///d:/myprojects/client/server/models/YouTubeCache.js)**:
  - Implemented MongoDB cache model with 24-hour TTL index to minimize API quota consumption.
- **[Song.js](file:///d:/myprojects/client/server/models/Song.js)**:
  - Updated normalized model: `{ id, youtubeVideoId, title, artist, album, category, coverImage, duration, source: "youtube", youtubeUrl, isPlayable }`.
- **[songController.js](file:///d:/myprojects/client/server/controllers/songController.js)**:
  - `/api/songs` & `/api/songs/:id/playback` endpoints serve normalized YouTube video metadata and IFrame playback instructions.

### 3. Official YouTube IFrame Player API Frontend Service
- **[youtubePlayer.js](file:///d:/myprojects/client/client/src/services/youtubePlayer.js)**:
  - Dynamically loads `https://www.youtube.com/iframe_api`.
  - Manages `window.YT.Player` lifecycle, methods (`loadVideoById`, `playVideo`, `pauseVideo`, `seekTo`, `setVolume`, `mute`, `unMute`), and event listeners (`onStateChange`, `onError`).
- **[MusicContext.jsx](file:///d:/myprojects/client/client/src/context/MusicContext.jsx)**:
  - Removed all HTML5 `new Audio()` logic.
  - Controls playback directly via `youtubePlayer` API methods.
  - Real playback state synchronization (`PLAYING`, `PAUSED`, `BUFFERING`, `ENDED`).
  - Auto-plays next video on `ENDED`.
  - Maintained history stack for `prevSong()` (`A -> B -> C -> D`).
  - Error handling: auto-skips unavailable or non-embeddable videos after 1.5 seconds.

### 4. Dedicated Embedded Viewport & Music UI
- **[MusicPlayer.jsx](file:///d:/myprojects/client/client/src/components/Player/MusicPlayer.jsx)**:
  - Contains a dedicated visible embedded YouTube video viewport container (`id="youtube-player-iframe"`).
  - Controls bound to YouTube player methods (Play/Pause, Next, Prev, Seek bar, Volume slider).
  - Updated quality badges to display **"Official YouTube playback"** (purged all 320 kbps MP3 claims).
- **[SongCard.jsx](file:///d:/myprojects/client/client/src/components/SongCard.jsx)**:
  - Updated card badges to **"YouTube"**.

---

## Verification Results

| Requirement | Implementation Status |
| --- | --- |
| **Provider Migration** | Spotify completely removed; replaced by YouTube Data API v3 & YouTube IFrame Player API |
| **No Audio Extraction** | No yt-dlp, no stream proxy, no local audio files, no HTML5 Audio |
| **Search & Discovery** | Search query and artist queries return real YouTube video metadata |
| **Video Validation** | Reject non-embeddable videos, private items, Shorts, Karaoke, and non-music videos |
| **Playback Control Flow** | Play, Pause, Resume, Seek, Volume, Mute, Next, Previous history, Auto-next on ENDED working |
| **Error Handling** | Handles error codes (2, 5, 100, 101, 150, 153) and auto-skips unavailable videos |
| **API Key Security** | `YOUTUBE_API_KEY` stored in `server/.env` and kept private |
| **Visual UI & Viewport** | Premium dark theme UI maintained with dedicated visible embedded YouTube viewport |
