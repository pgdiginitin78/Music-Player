# Vercel Production Deployment Preparation Plan

Prepare the existing **React + Vite + Tailwind + Express + MongoDB + YouTube** Music Player application for a seamless, clean production deployment on Vercel, while ensuring local development (`localhost:5173` and `localhost:5000`) continues to function without issues.

## User Review Required

> [!IMPORTANT]
> **No Rebuilding / No UI Design Changes**: The existing UI design, components, and animations will remain unchanged.
> **Provider & Audio Engine**: Music playback continues strictly via **Official YouTube Data API v3** and **YouTube IFrame Player API**. No audio stream extraction, downloading, or Spotify integration will be used.
> **Environment Credentials**: You will need to set the environment variables `YOUTUBE_API_KEY` and `MONGODB_URI` in your Vercel Project Dashboard.

## Key Changes & Architecture

### 1. Monorepo Root & Build Configuration
- Update root [package.json](file:///d:/myprojects/client/package.json) to set Node engine to `22.x` and add build/dev scripts.
- Configure [vercel.json](file:///d:/myprojects/client/vercel.json) at root to route `/api/(.*)` to the Express Serverless Function and static frontend assets to `client/dist`.

### 2. Express Server Restructuring & Vercel Serverless Function
- Create [server/app.js](file:///d:/myprojects/client/server/app.js) to initialize Express app, middleware, CORS, routes, health check (`GET /api/health`), and global JSON error handler.
- Create [api/index.js](file:///d:/myprojects/client/api/index.js) at the workspace root to export `app` as a Vercel Serverless Function entry point.
- Update [server/server.js](file:///d:/myprojects/client/server/server.js) to import `app` from `./app.js` for local development (`app.listen(PORT)`).

### 3. Reusable Cached MongoDB Connection
- Update [server/config/db.js](file:///d:/myprojects/client/server/config/db.js) with Mongoose connection caching (`global.mongoose`) to reuse connections across Vercel serverless function warm starts.

### 4. API Endpoints & Configurable API Base URL
- Update [client/src/services/api.js](file:///d:/myprojects/client/client/src/services/api.js) to use `import.meta.env.VITE_API_BASE_URL || "/api"`.
- Update [client/vite.config.js](file:///d:/myprojects/client/client/vite.config.js) with `/api` proxy pointing to `http://localhost:5000` for local development.
- Add `GET /api/songs/search` route and parameter handling in [server/routes/songs.js](file:///d:/myprojects/client/server/routes/songs.js) and [server/controllers/songController.js](file:///d:/myprojects/client/server/controllers/songController.js).
- Ensure `GET /api/health` returns status, database connection state, and YouTube key status cleanly.

### 5. Cleaning Legacy Deprecated Files
- Remove deprecated legacy stream/spotify script files ([server/routes/stream.js](file:///d:/myprojects/client/server/routes/stream.js), [server/controllers/streamController.js](file:///d:/myprojects/client/server/controllers/streamController.js), [server/services/providers/spotifyService.js](file:///d:/myprojects/client/server/services/providers/spotifyService.js), [server/scripts/test_spotify.js](file:///d:/myprojects/client/server/scripts/test_spotify.js), [server/scripts/verify_stream.js](file:///d:/myprojects/client/server/scripts/verify_stream.js)).

---

## Proposed Changes

### Root Workspace

#### [NEW] [vercel.json](file:///d:/myprojects/client/vercel.json)
- Define Vercel build command, output directory (`client/dist`), and URL rewrites for `/api/*` to serverless function and static client routes.

#### [NEW] [api/index.js](file:///d:/myprojects/client/api/index.js)
- Serverless entry point importing `server/app.js` and exporting Express `app`.

#### [MODIFY] [package.json](file:///d:/myprojects/client/package.json)
- Set `"engines": { "node": "22.x" }` and add build/dev scripts.

#### [MODIFY] [.env.example](file:///d:/myprojects/client/.env.example)
- Provide example env variables without secrets: `YOUTUBE_API_KEY=`, `MONGODB_URI=`, `VITE_API_BASE_URL=`.

---

### Backend Component (`server/`)

#### [NEW] [server/app.js](file:///d:/myprojects/client/server/app.js)
- Decoupled Express application setup with middleware, CORS, `/api/health`, `/api/songs`, `/api/categories`, and global JSON error handler.

#### [MODIFY] [server/server.js](file:///d:/myprojects/client/server/server.js)
- Simplified entry point for local server execution (`app.listen(5000)`).

#### [MODIFY] [server/config/db.js](file:///d:/myprojects/client/server/config/db.js)
- Implement cached Mongoose connection pattern for Vercel serverless execution.

#### [MODIFY] [server/routes/songs.js](file:///d:/myprojects/client/server/routes/songs.js)
- Add `/search` route to handle `GET /api/songs/search?q=...`.

#### [MODIFY] [server/controllers/songController.js](file:///d:/myprojects/client/server/controllers/songController.js)
- Support `q` query parameter for search and return clean JSON error objects on YouTube Data API failure.

#### [MODIFY] [server/controllers/categoryController.js](file:///d:/myprojects/client/server/controllers/categoryController.js)
- Fall back to static curated categories array if MongoDB is disconnected.

#### [DELETE] [server/routes/stream.js](file:///d:/myprojects/client/server/routes/stream.js)
#### [DELETE] [server/controllers/streamController.js](file:///d:/myprojects/client/server/controllers/streamController.js)
#### [DELETE] [server/services/providers/spotifyService.js](file:///d:/myprojects/client/server/services/providers/spotifyService.js)
#### [DELETE] [server/scripts/test_spotify.js](file:///d:/myprojects/client/server/scripts/test_spotify.js)
#### [DELETE] [server/scripts/verify_stream.js](file:///d:/myprojects/client/server/scripts/verify_stream.js)

---

### Frontend Component (`client/`)

#### [MODIFY] [client/src/services/api.js](file:///d:/myprojects/client/client/src/services/api.js)
- Update `API_URL` to use `import.meta.env.VITE_API_BASE_URL || "/api"`.

#### [MODIFY] [client/vite.config.js](file:///d:/myprojects/client/client/vite.config.js)
- Add dev proxy configuration for `/api` targeting `http://localhost:5000`.

#### [MODIFY] [client/src/components/Player/MusicPlayer.jsx](file:///d:/myprojects/client/client/src/components/Player/MusicPlayer.jsx)
- Ensure YouTube IFrame Player DOM container `#youtube-player-iframe` remains safely mounted in the DOM.

---

## Verification Plan

### Automated Build Verification
1. Run `npm run build` in root workspace and verify `client/dist` is produced without TypeScript/Vite errors.

### Endpoints Verification
1. Start local server (`npm run dev:server` or `node server/server.js`) and test endpoints using `curl` / HTTP fetch:
   - `GET /api/health` -> Expect 200 JSON with status `ok`.
   - `GET /api/songs` -> Expect 200 JSON array of songs.
   - `GET /api/songs/search?q=Arijit%20Singh` -> Expect 200 JSON array of YouTube search results.
   - `GET /api/songs/search?q=Anuv%20Jain` -> Expect 200 JSON array.
   - `GET /api/songs/search?q=Darshan%20Raval` -> Expect 200 JSON array.
   - `GET /api/categories` -> Expect 200 JSON array of categories.

### Vercel CLI Local Environment Test
1. Run `vercel dev` to simulate Vercel serverless environment locally.
2. Verify all API routes and frontend pages render seamlessly.
