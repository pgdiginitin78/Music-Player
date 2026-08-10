# Implementation Plan — Migrate to Official YouTube Data API v3 & YouTube IFrame Player API

Completely migrate the Hindi music streaming application from Spotify to official YouTube APIs:
- **Server**: YouTube Data API v3 (`search.list`, `videos.list`) with server-side API key and MongoDB caching.
- **Client**: Official YouTube IFrame Player API (`YT.Player`) with dedicated visible player viewport and seamless control flow.
- **Purge**: Complete removal of Spotify API code, Spotify tokens, HTML5 `<audio>` elements, and audio stream extraction/proxies.

## User Review Required

> [!IMPORTANT]
> - **Official YouTube Playback**: Playback will run directly through the official YouTube IFrame Player API. Audio stream extraction (`yt-dlp`, `/api/songs/:id/stream`, HTML5 Audio) is completely removed per YouTube Terms of Service and user specifications.
> - **Dedicated Visible Viewport**: Per YouTube requirements, the YouTube IFrame player will remain a valid, visible embedded player component within the application interface (not `display:none` or `1px x 1px`).
> - **API Key Security**: `YOUTUBE_API_KEY` is kept private inside `server/.env` and never exposed to client-side JS.

## Proposed Changes

---

### Backend Components

#### [MODIFY] [server/.env](file:///d:/myprojects/client/server/.env)
- Add `YOUTUBE_API_KEY=AIzaSyCMmBDbDDlE_mHSmPNf_igv_-QWsMDIn8U`.
- Remove Spotify environment variables (`SPOTIFY_TOKEN`, `SPOTIFY_API_URL`, etc.).

#### [NEW] [server/models/YouTubeCache.js](file:///d:/myprojects/client/server/models/YouTubeCache.js)
- Create MongoDB model for caching YouTube search responses by query/category with TTL index to optimize API quota.

#### [NEW] [server/services/providers/youtubeProvider.js](file:///d:/myprojects/client/server/services/providers/youtubeProvider.js)
- Implement `searchSongs()`, `searchArtist()`, `getSong()`, `getCategories()`.
- Define `categoryQueryMap.js` mapping for all 13 categories (Bollywood Hits, Romantic, Lo-Fi, Old Hindi, Rain, etc.).
- Query YouTube Data API v3 `search.list` (`part=snippet`, `type=video`, `maxResults=25`).
- Query `videos.list` (`part=snippet,contentDetails,status`) to filter out non-embeddable videos, private/removed items, Shorts, Karaoke, and non-music uploads.
- Return normalized song schema with `youtubeVideoId`, `youtubeUrl`, `coverImage`, `duration`, `source: "youtube"`, `isPlayable: true`.

#### [MODIFY] [server/services/musicService.js](file:///d:/myprojects/client/server/services/musicService.js)
- Switch service provider interface to delegate all catalog operations to `youtubeProvider.js`.

#### [MODIFY] [server/services/providers/musicProvider.js](file:///d:/myprojects/client/server/services/providers/musicProvider.js)
- Replace Spotify integration with YouTube integration.

#### [MODIFY] [server/controllers/songController.js](file:///d:/myprojects/client/server/controllers/songController.js)
- Update `getSongs`, `getSongById`, `getSongPlayback` to serve normalized YouTube metadata and video IDs.
- Remove stream proxy logic.

#### [MODIFY] [server/routes/songs.js](file:///d:/myprojects/client/server/routes/songs.js)
- Remove `/api/songs/:id/stream` route.
- Keep `/api/songs`, `/api/songs/search`, `/api/songs/artist`, `/api/songs/:id`, `/api/songs/:id/playback`.

#### [MODIFY] [server/server.js](file:///d:/myprojects/client/server/server.js)
- Remove `streamRoutes` mounting. Update startup logs for `YOUTUBE_API_KEY`.

#### [DELETE] [server/services/providers/spotifyService.js](file:///d:/myprojects/client/server/services/providers/spotifyService.js)
#### [DELETE] [server/services/providers/jiosaavnService.js](file:///d:/myprojects/client/server/services/providers/jiosaavnService.js)
#### [DELETE] [server/routes/stream.js](file:///d:/myprojects/client/server/routes/stream.js)
#### [DELETE] [server/controllers/streamController.js](file:///d:/myprojects/client/server/controllers/streamController.js)
#### [DELETE] [server/scripts/test_spotify.js](file:///d:/myprojects/client/server/scripts/test_spotify.js)

#### [NEW] [server/scripts/test_youtube.js](file:///d:/myprojects/client/server/scripts/test_youtube.js)
- Script to test backend YouTube search and `videos.list` validation.

---

### Frontend Components

#### [NEW] [client/src/services/youtubePlayer.js](file:///d:/myprojects/client/client/src/services/youtubePlayer.js)
- Create YouTube IFrame Player API manager script.
- Handles script loading, player instantiation in a container element, state updates (`PLAYING`, `PAUSED`, `BUFFERING`, `ENDED`), autoplay block handling, error handling (`2`, `5`, `100`, `101`, `150`, `153`), seeking, and volume controls.

#### [MODIFY] [client/src/context/MusicContext.jsx](file:///d:/myprojects/client/client/src/context/MusicContext.jsx)
- Remove HTML5 `Audio()` player logic completely.
- Integrate `youtubePlayer.js` wrapper.
- Manage playback states directly from `YT.PlayerState`.
- Maintain history stack for `prevSong()` (`A -> B -> C -> D`).
- Auto-play next song on `ENDED`.
- Handle YouTube playback errors by marking video unavailable and auto-skipping to the next playable track.

#### [MODIFY] [client/src/components/Player/MusicPlayer.jsx](file:///d:/myprojects/client/client/src/components/Player/MusicPlayer.jsx)
- Render dedicated visible YouTube embedded player viewport.
- Display "Official YouTube playback" badge (no fixed 320 kbps MP3 claims).
- Bind UI buttons (Play/Pause, Next, Prev, Seek bar, Volume) to YouTube player controller.

---

## Verification Plan

### Automated / Script Tests
- Run `node server/scripts/test_youtube.js` to verify search queries for Arijit Singh, Anuv Jain, Darshan Raval, Bollywood Hits, Romantic, etc.

### Manual Verification
- Test artist search ("Arijit Singh", "Anuv Jain", "Darshan Raval").
- Test category switching (Bollywood Hits, Romantic Hindi, Old Hindi, Rain Hindi, Lo-Fi Hindi).
- Verify YouTube embedded player loads and displays proper video viewport.
- Verify controls: Play, Pause, Resume, Seek, Volume, Mute, Next, Previous history, Shuffle.
- Verify auto-next progression on song end.
- Verify error handling on restricted/non-embeddable videos (automatic skip).
