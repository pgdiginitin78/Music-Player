# PARO — Fast, Voice-First, Personalized AI Music Companion Implementation Plan

PARO is a voice-first, low-latency, personalized AI music companion seamlessly integrated into your music application. It features a 3-level fast processing pipeline, native Web Speech integration, theme-aware glassmorphic UI, predictive queue re-ranking, and strict per-user data isolation.

---

## ⚡ Performance Audit & Bottleneck Analysis

| Bottleneck in Previous System | Solution in PARO Architecture | Target Latency |
| :--- | :--- | :--- |
| **Python Process Spawning** (`spawn python index.py` per request adds ~500ms CLI startup overhead) | **Node.js Fast Intent Router (`paroFastRouter.js`)** handles Level 1 & Level 2 intents directly in Node.js memory. Python daemon handles Level 3. | **< 100ms** |
| **Sequential DB & Search Queries** (User Profile → Likes → Events → YouTube Search sequentially) | **Parallel Async Execution (`Promise.all`)** for candidate search, user profile loading, and trend calculation. | **< 200ms** |
| **No Client-side Command Routing** (Simple "pause" or "skip" commands sent to server) | **Level 1 Client Intent Engine** executes instant playback controls (`pause`, `play`, `skip`, `volume`) locally in browser. | **< 50ms** |
| **No Request Interruption** (Rapid speech creates out-of-order execution) | **AbortController & Request Cancellation (`latestRequestId`)** ensures latest intent wins. | **Instant Override** |

---

## 🏗️ PARO 3-Level Processing Architecture

```
                                  User Voice / Text Input
                                             │
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │    Level 1: Local Client Engine (Browser < 50ms)        │
                 │  (Play, Pause, Resume, Skip, Next, Previous, Volume)  │
                 └───────────────────────────┬────────────────────────────┘
                                             │ (If not Level 1)
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │     Level 2: Fast Server Intent Router (< 150ms)       │
                 │ ("play romantic songs", "play Arijit", "trending")     │
                 └───────────────────────────┬────────────────────────────┘
                                             │ (If complex conversation)
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │    Level 3: Deep Conversational Engine (Python AI)      │
                 │ ("Why did you pick this?", "Slowly raise the vibe")    │
                 └────────────────────────────────────────────────────────┘
```

---

## 📁 File-by-File Implementation Plan

### 1. Client-Side Voice Engine & Theme-Aware UI (React)

#### [NEW] [PAROVoiceEngine.js](file:///d:/myprojects/client/client/src/services/PAROVoiceEngine.js)
- Manages Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`).
- Handles Voice Activity Detection (VAD), continuous listening, speech transcript parsing, and speech synthesis.
- Implements request cancellation (`AbortController` & `latestRequestId`).

#### [NEW] [ParoWidget.jsx](file:///d:/myprojects/client/client/src/components/PARO/ParoWidget.jsx)
- Theme-aware visual widget matching `ThemeContext` design tokens (glow, primary colors, backdrop glassmorphism).
- Displays visual states: `idle`, `listening`, `processing`, `thinking`, `playing`, `speaking`, `error`.
- Renders animated voice pulse ring during microphone input and quick action pills.

#### [MODIFY] [App.jsx](file:///d:/myprojects/client/client/src/App.jsx)
- Renders `<ParoWidget />` seamlessly above music player bar.

---

### 2. Backend Fast Intent Router & Services (Node.js Express)

#### [NEW] [paroFastRouter.js](file:///d:/myprojects/client/server/services/paroFastRouter.js)
- High-speed in-memory intent router. Evaluates pattern matches and mood dictionaries in **< 5ms** without requiring external process or LLM calls for common music queries.

#### [NEW] [paroPredictiveQueue.js](file:///d:/myprojects/client/server/services/paroPredictiveQueue.js)
- Background pre-fetching service: predicts and pre-ranks upcoming 5-10 songs while current track is playing.

#### [NEW] [paroRoutes.js](file:///d:/myprojects/client/server/routes/paroRoutes.js)
- Fast PARO API Endpoints under `/api/paro`:
  - `POST /api/paro/command` (Level 1, Level 2, Level 3 fast processing pipeline).
  - `POST /api/paro/events` (Batch listening event pipeline).
  - `GET /api/paro/predictive-queue` (Predictive queue pre-fetch).

#### [MODIFY] [app.js](file:///d:/myprojects/client/server/app.js)
- Mounts `/api/paro` route handler.

---

### 3. Python Persistent AI Daemon & Optimization (`ai/pulseMind/`)

#### [MODIFY] [index.py](file:///d:/myprojects/client/ai/pulseMind/index.py)
- Updated for low-latency JSON payload evaluation and intent caching.

---

## 🧪 Verification & Latency Test Plan

### Latency Targets
1. **Level 1 Instant Commands** (`pause`, `skip`, `volume`): **< 50ms**
2. **Level 2 Music Intent** (`"play romantic songs"`, `"trending"`): **< 200ms**
3. **Level 3 Complex AI Conversation**: **Streamed immediately**

### Cross-User Security Verification
- Ensure `req.userContext.userId` is enforced across all 3 levels.
