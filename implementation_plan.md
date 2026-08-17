# Implementation Plan: iOS Web/PWA, Speech Recognition & Background Audio Optimization

Ensure PARO Voice Assistant and the Music Player web application deliver production-grade reliability across iPhone/iOS (Mobile Safari, iOS Chrome, iOS Edge, iOS Firefox, standalone PWA) and Desktop browsers, adhering strictly to iOS WebKit platform capabilities and security policies.

## User Review Required

> [!IMPORTANT]
> - **iOS Capability Detection**: Centralized in `deviceCapabilities.js`. Detects iOS/iPadOS, WebKit engines, PWA standalone mode, HTTPS secure context, and `SpeechRecognition` / `webkitSpeechRecognition` availability.
> - **iOS Speech Recognition UX**: On iOS (where WebKit suspends background/idle SpeechRecognition and cuts off continuous mic loops), PARO gracefully falls back to **User-Activated Tap-to-Talk**. The user taps the microphone button, speaks a command (e.g., "Play Kesariya"), and PARO executes the action and returns to IDLE. On Desktop, the full `"Hey Paro"` wake-word activation lifecycle remains active.
> - **iOS Background Audio & Media Session**: Music playback continues when the app goes into the background or the screen locks (where iOS/browser policies permit). Media Session API metadata (title, artist, album, artwork) and lock-screen controls (play, pause, next, previous, seek) are synchronized with the YouTube player engine.
> - **PWA Support**: Meta tags and Web App Manifest (`manifest.json`) added to enable standalone PWA mode on iOS ("Add to Home Screen").

## Proposed Changes

### Client Services & Configuration

#### [NEW] [deviceCapabilities.js](file:///d:/myprojects/client/client/src/services/deviceCapabilities.js)
- Implements centralized capability detection: `isIOS`, `isSafari`, `isStandalonePWA`, `isSecureContext`, `supportsSpeechRecognition`, `supportsContinuousWakeWord`, `supportsMediaSession`, `supportsMicrophone`.
- Provides `getParoDiagnostics()` for diagnostic panel reporting.

#### [MODIFY] [PAROVoiceEngine.js](file:///d:/myprojects/client/client/src/services/PAROVoiceEngine.js)
- Imports `deviceCapabilities`.
- If `supportsContinuousWakeWord` is `false` (iOS browsers):
  - Disables continuous wake-word background loops to prevent WebKit `onerror` loops (`not-allowed` / `audio-capture`), battery drain, and browser suspension.
  - Configures `idle` state to prompt: *"Tap mic to talk to PARO"*.
  - When mic is tapped, initiates single-shot recognition, listens for 1 command, executes, and cleanly returns to `idle`.
- If `supportsContinuousWakeWord` is `true` (Desktop Chrome/Edge):
  - Preserves full `"Hey Paro"` wake-word activation lifecycle.
- Handles `visibilitychange`: Pauses recognition when `document.visibilityState === 'hidden'` and recovers safely on `visible`.
- Checks `window.isSecureContext` and handles getUserMedia track cleanup (`track.stop()`).

#### [MODIFY] [MusicContext.jsx](file:///d:/myprojects/client/client/src/context/MusicContext.jsx)
- Ensures Media Session API action handlers (`play`, `pause`, `previoustrack`, `nexttrack`, `seekto`) are registered and metadata is updated on track changes.
- Ensures visibility changes do NOT forcibly pause background music playback when the app is minimized/locked.

#### [MODIFY] [index.html](file:///d:/myprojects/client/client/index.html)
- Adds iOS Web App meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`) and link to `manifest.json`.

#### [NEW] [manifest.json](file:///d:/myprojects/client/client/public/manifest.json)
- Configures Web App Manifest for PWA installation (`display: standalone`, `theme_color`, `icons`).

#### [MODIFY] [ParoWidget.jsx](file:///d:/myprojects/client/client/src/components/PARO/ParoWidget.jsx)
- Updates `getStateText()` to display platform-appropriate instructions.
- Includes `getParoDiagnostics()` in the DEV diagnostic panel.

## Verification Plan

### Manual Verification
1. **iOS / Mobile Safari Test**:
   - Open app on iOS or simulate Mobile Safari.
   - Verify PARO shows *"Tap mic to talk to PARO"*.
   - Tap mic -> Speak "Play Kesariya" -> Verify search succeeds and song plays.
2. **Desktop Test**:
   - Speak "Hey Paro" -> Verify PARO greets and listens for command.
3. **Background Music & Media Session Test**:
   - Start song playback -> Switch apps or lock screen -> Verify lock screen displays song title/artist/artwork and Media Session controls work.
4. **PWA Installation Test**:
   - Verify manifest.json and Apple meta tags load cleanly without errors.
