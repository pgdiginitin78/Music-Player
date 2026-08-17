import { sendParoCommandApi } from "./api.js";
import voiceService from "./VoiceService.js";
import {
  isIOS,
  isSecureContext,
  supportsSpeechRecognition,
  SpeechRecognitionClass,
  supportsMicrophone,
  supportsContinuousWakeWord,
  getParoDiagnostics,
} from "./deviceCapabilities.js";

/**
 * Normalizes a raw transcript for matching: lowercases, trims, collapses
 * whitespace, and strips common trailing punctuation. Safe on empty/undefined
 * input. Devanagari (Hindi) text passes through unchanged aside from
 * trimming/whitespace collapsing, since it has no case to fold.
 */
export function normalizeTranscript(text = "") {
  if (!text || typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[\?\.\!,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Picks a random element from an array. Returns '' for empty/invalid input
 * so callers can safely interpolate the result.
 */
export function pickRandom(options = []) {
  if (!Array.isArray(options) || options.length === 0) return "";
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Robust Natural Language Intent & Bare Song Parser for PARO
 */
export function parseParoCommand(transcript = "") {
  if (!transcript || typeof transcript !== "string") {
    return { intent: "UNKNOWN", query: null };
  }

  const raw = transcript.trim();
  const lower = normalizeTranscript(raw);

  if (
    /\b(weather|joke|who are you|what can you do|how are you|time|what time)\b/.test(
      lower,
    )
  ) {
    return { intent: "NON_MUSIC_QUERY", query: raw };
  }
  if (/\b(pause|stop|hold on|pause music|pause song)\b/.test(lower)) {
    return { intent: "PAUSE", query: null };
  }
  if (
    /\b(resume|continue|continue playing)\b/.test(lower) ||
    (/\b(play)\b/.test(lower) && lower.length < 8)
  ) {
    return { intent: "RESUME", query: null };
  }
  if (/\b(next|next song|play next|skip|skip song)\b/.test(lower)) {
    return { intent: "NEXT", query: null };
  }
  if (
    /\b(previous|previous song|play previous|go back|last song)\b/.test(lower)
  ) {
    return { intent: "PREVIOUS", query: null };
  }
  if (/\b(volume up|increase volume|louder)\b/.test(lower)) {
    return { intent: "VOLUME_UP", query: null };
  }
  if (/\b(volume down|decrease volume|softer|quieter)\b/.test(lower)) {
    return { intent: "VOLUME_DOWN", query: null };
  }
  if (/\b(mute|silence)\b/.test(lower)) {
    return { intent: "MUTE", query: null };
  }
  if (/\b(unmute)\b/.test(lower)) {
    return { intent: "UNMUTE", query: null };
  }
  if (
    /\b(what song|whats playing|what is playing|current song|what song is playing)\b/.test(
      lower,
    )
  ) {
    return { intent: "CURRENT_SONG", query: null };
  }

  let cleanQuery = raw;
  cleanQuery = cleanQuery.replace(
    /^(?:paro,?\s*)?(?:can you\s+)?(?:please\s+)?(?:play|put on|start|listen to|find|search for)\s+(?:the song\s+|that song\s+|a song\s+|track\s+)?/i,
    "",
  );
  cleanQuery = cleanQuery.replace(/^(?:चलो|सुनो|मुझे|ज़रा|प्लीज)\s+/i, "");
  cleanQuery = cleanQuery.replace(
    /\s+(?:बजाओ|चला दो|चलाओ|सुनना है|सुनवा दो|गाना बजाओ|सॉन्ग चलाओ|ग़ाना चला दो|baja do|chalao|play karo|sunao|bajao)$/i,
    "",
  );
  cleanQuery = cleanQuery.replace(/[\?\.\!]$/, "").trim();

  if (!cleanQuery || cleanQuery.length < 2) {
    return { intent: "UNKNOWN", query: null };
  }

  return { intent: "PLAY_SONG", query: cleanQuery };
}

/**
 * Robust Wake Word Matcher for "Hey Paro"
 */
export function isWakeWord(rawText = "") {
  const norm = normalizeTranscript(rawText);
  if (!norm) return false;

  const IGNORED_GENERIC = [
    "hello",
    "hey",
    "hi",
    "play",
    "pause",
    "stop",
    "next",
    "previous",
    "skip",
  ];
  if (IGNORED_GENERIC.includes(norm)) return false;

  const wakeWordPatterns = [
    /\b(hey|hi|hello|hay|hie)?\s*(paro|pero|paroh|baro|faro|pyaro|apparo|sparrow)\b/i,
    /(हे|हेय|हाय|हेलो)\s*(पारो|पेरो)/u,
    /\bhey\s+paro\b/i,
    /\bhi\s+paro\b/i,
  ];

  return wakeWordPatterns.some((pattern) => pattern.test(norm));
}

/**
 * PARO Voice Assistant Engine
 *
 * Authoritative Single Lifecycle:
 *   startParoSession()  → creates fresh session + fresh SpeechRecognition
 *   stopParoSession()   → hard reset, idempotent, invalidates all async callbacks
 *
 * Root causes fixed in this version:
 *   A. recognition was nulled AFTER abort() — stale onend could fire on dead instance.
 *      FIX: null this.recognition BEFORE calling abort() so isLive() = false immediately.
 *   B. stop() was called after abort() → InvalidStateError in some browsers.
 *      FIX: only abort() is called; stop() is only used in stopRecognitionSafely().
 *   C. startParoSession incremented sessionId TWICE (once in stopParoSession it called,
 *      once itself) → session IDs became inconsistent across OPEN/CLOSE cycles.
 *      FIX: _hardReset() is the single incrementor. startParoSession reads post-reset ID.
 *   D. onend could schedule restart on a stale instance.
 *      FIX: onend checks instance identity + session ID + isModalOpen before AND when timer fires.
 */
class PAROVoiceEngine {
  constructor() {
    // Session counter — incremented ONLY in _hardReset().
    this._sessionId = 0;
    this.isModalOpen = false;
    this.microphoneStream = null;

    this.ws = null;
    this.isWsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;

    // The LIVE recognition instance. Nulled by _hardReset() BEFORE abort().
    this.recognition = null;
    this.isListening = false;
    this.isRecognitionRunning = false;
    this.isWakeListenerActive = true;

    this.state = "idle";
    this.permissionState = "unknown";

    this.commandTimeoutTimer = null;
    this.restartDelayTimer = null;

    const capabilities = getParoDiagnostics();

    console.log("[PARO-LIFECYCLE] Assistant initialized");
    console.log(
      "[PARO] Browser:",
      typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
    );
    console.log("[PARO] iOS:", isIOS);
    console.log(
      "[PARO] SpeechRecognition:",
      typeof window !== "undefined" && Boolean(window.SpeechRecognition),
    );
    console.log(
      "[PARO] webkitSpeechRecognition:",
      typeof window !== "undefined" && Boolean(window.webkitSpeechRecognition),
    );
    console.log("[PARO] Microphone:", capabilities.microphoneAvailable);
    console.log(
      "[PARO] supportsContinuousWakeWord:",
      supportsContinuousWakeWord,
    );

    this.debugInfo = {
      pythonVoiceService: "DISCONNECTED",
      platform: capabilities.platform,
      isIOS: capabilities.isIOS,
      isPWA: capabilities.isPWA,
      isSecureContext: capabilities.isSecureContext,
      microphone: capabilities.microphoneAvailable,
      permission: "UNKNOWN",
      speechRecognition: capabilities.speechRecognitionSupported,
      engine: capabilities.speechRecognitionEngine,
      wakeWordMode: capabilities.wakeWordMode,
      interactionMode: capabilities.interactionMode,
      lastTranscript: "None",
      wakeWord: "NOT_DETECTED",
      command: "None",
      intent: "NONE",
      search: "NONE",
      matchedSong: "None",
      player: "IDLE",
      voice: "IDLE",
      lastError: null,
      latencyMs: 0,
    };

    this.listeners = new Set();
    this.latestRequestId = 0;
    this.activeAbortController = null;
    this.latestPlayerState = null;
    this.latestPlayerControls = null;

    this.initVisibilityHandler();
    this.initPythonVoiceWebSocket();
    this.startHealthCheckPolling();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHORITATIVE LIFECYCLE 1: startParoSession
  // ─────────────────────────────────────────────────────────────────────────
  startParoSession(playerState = {}, playerControls = {}) {
    // Step 1: Defensive hard-reset. Increments _sessionId, nulls recognition,
    // clears timers, stops TTS. Does NOT emit 'close' event (calledFromStart=true).
    this._hardReset(true);

    // Step 2: Read the post-reset session ID. This is the ONE session ID for all
    // closures in this session. We do NOT increment again.
    const capturedSessionId = this._sessionId;
    this.isModalOpen = true;

    console.log("[PARO-LIFECYCLE] OPEN");
    console.log(`[PARO-SESSION] ${capturedSessionId}`);

    this.latestPlayerState = playerState;
    this.latestPlayerControls = playerControls;
    this.setState("idle");

    // Step 3: Create fresh SpeechRecognition (only if browser-based, not WS).
    if (supportsSpeechRecognition && !this.isWsConnected) {
      this._createAndStartRecognition(capturedSessionId);
    } else if (this.isWsConnected) {
      console.log("[PARO-RECOGNITION] Skipped — Python WS is active");
    } else {
      console.warn("[PARO-RECOGNITION] SpeechRecognition not supported");
    }

    return capturedSessionId;
  }

  /**
   * Creates a new SpeechRecognition instance with full dual-guard callbacks.
   * capturedSessionId + instance identity check on every async callback.
   */
  _createAndStartRecognition(capturedSessionId) {
    try {
      const instance = new SpeechRecognitionClass();
      instance.continuous = supportsContinuousWakeWord;
      instance.interimResults = true;
      instance.lang =
        typeof navigator !== "undefined" && navigator.language.startsWith("hi")
          ? "hi-IN"
          : "en-IN";

      // Store the live reference BEFORE attaching handlers.
      this.recognition = instance;
      console.log("[PARO-RECOGNITION] CREATE");

      // isLive(): returns true only if this callback belongs to the current live session.
      const isLive = () =>
        this.recognition === instance && // instance identity guard
        this._sessionId === capturedSessionId && // session ID guard
        this.isModalOpen; // modal open guard

      instance.onstart = () => {
        if (!isLive()) {
          console.log("[PARO-RECOGNITION] STARTED (stale — ignored)");
          return;
        }
        this.isListening = true;
        this.isRecognitionRunning = true;
        this.permissionState = "granted";
        this.debugInfo.permission = "GRANTED";
        this.debugInfo.microphone = "AVAILABLE";
        this.debugInfo.speechRecognition = "LISTENING";
        console.log("[PARO-RECOGNITION] STARTED");
      };

      instance.onresult = (event) => {
        if (!isLive() || this.state === "speaking") return;

        let interimText = "";
        let finalDone = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          interimText += res[0].transcript;
          if (res.isFinal) finalDone = true;
        }

        const cleanInterim = interimText.trim();
        if (!cleanInterim) return;

        console.log("[PARO-RECOGNITION] RESULT:", cleanInterim);
        console.log("[PARO-WAKE] CHECK:", cleanInterim);

        this.notifyListeners({ type: "transcript", text: cleanInterim });

        if (finalDone) {
          this.handleIncomingTranscript(cleanInterim);
        } else if (this.state === "idle" && supportsContinuousWakeWord) {
          if (isWakeWord(cleanInterim)) {
            console.log("[PARO-WAKE] DETECTED");
            this.handleIncomingTranscript(cleanInterim);
          }
        }
      };

      instance.onerror = (event) => {
        if (!isLive()) {
          console.log(
            `[PARO-RECOGNITION] ERROR on stale instance (${event.error}) — ignored`,
          );
          return;
        }
        this.isListening = false;
        this.isRecognitionRunning = false;
        console.log("[PARO-RECOGNITION] ERROR:", event.error);

        // 'aborted' and 'no-speech' are normal operational errors — not bugs.
        if (event.error !== "no-speech" && event.error !== "aborted") {
          this.debugInfo.lastError = event.error;
        }

        if (event.error === "not-allowed") {
          this.permissionState = "denied";
          this.debugInfo.permission = "DENIED";
          this.setState("error");
          this.notifyListeners({
            type: "error",
            message:
              "Microphone access is blocked. Please enable Microphone permission in browser settings.",
          });
        } else if (
          event.error === "audio-capture" ||
          event.error === "service-not-allowed"
        ) {
          this.setState("error");
          this.notifyListeners({
            type: "error",
            message:
              "Microphone hardware unavailable or unsupported in this browser view.",
          });
        }
      };

      // CRITICAL: onend must NEVER blindly restart. All 3 guards must pass.
      instance.onend = () => {
        // Guard 1: Instance identity — are we the current live instance?
        if (this.recognition !== instance) {
          console.log("[PARO-RECOGNITION] END (stale instance — NO restart)");
          return;
        }
        // Guard 2: Session ID — is this still the current session?
        if (this._sessionId !== capturedSessionId) {
          console.log(
            "[PARO-RECOGNITION] END (session invalidated — NO restart)",
          );
          return;
        }
        // Guard 3: Modal open — is Paro still open?
        if (!this.isModalOpen) {
          console.log("[PARO-RECOGNITION] END (modal closed — NO restart)");
          return;
        }

        this.isListening = false;
        this.isRecognitionRunning = false;
        console.log("[PARO-RECOGNITION] END");

        // Restart wake-word listener only when all conditions pass.
        const shouldRestart =
          supportsContinuousWakeWord &&
          !this.isWsConnected &&
          this.isWakeListenerActive &&
          this.state === "idle";

        if (shouldRestart) {
          if (this.restartDelayTimer) {
            clearTimeout(this.restartDelayTimer);
            this.restartDelayTimer = null;
          }
          this.restartDelayTimer = setTimeout(() => {
            // Re-check ALL 6 conditions when the timer actually fires.
            if (
              this.recognition === instance &&
              this._sessionId === capturedSessionId &&
              this.isModalOpen &&
              this.state === "idle" &&
              !this.isWsConnected &&
              this.isWakeListenerActive
            ) {
              console.log(
                "[PARO-RECOGNITION] Restarting wake-word listener...",
              );
              this.startRecognitionSafely();
            } else {
              console.log(
                "[PARO-RECOGNITION] Restart timer fired — conditions changed, skipped",
              );
            }
          }, 500);
        }
      };

      // Set isRecognitionRunning BEFORE start() so a rapid onend cannot
      // cause startRecognitionSafely to double-start this instance.
      this.isRecognitionRunning = true;
      console.log("[PARO-RECOGNITION] START_REQUEST");
      instance.start();
    } catch (err) {
      console.warn("[PARO-RECOGNITION] CREATE/START EXCEPTION:", err.message);
      this.isRecognitionRunning = false;
      this.recognition = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHORITATIVE LIFECYCLE 2: stopParoSession (Hard Reset)
  // ─────────────────────────────────────────────────────────────────────────
  stopParoSession() {
    this._hardReset(false);
  }

  /**
   * Internal hard-reset. Single source of truth for all teardown.
   * Always idempotent — safe to call multiple times.
   *
   * @param {boolean} calledFromStart - true = defensive cleanup inside startParoSession,
   *   does NOT emit the 'close' event. false = explicit user close, emits 'close'.
   *
   * CRITICAL ORDER:
   *   1. Increment _sessionId FIRST → invalidates all async callbacks immediately.
   *   2. Clear restart timer BEFORE nulling recognition.
   *   3. Null this.recognition BEFORE calling abort() → isLive() = false immediately.
   *   4. Do NOT call stop() after abort() → avoids InvalidStateError.
   *   5. Clear TTS, timers, API abort, state reset.
   *   6. Emit 'close' only for explicit user close.
   */
  _hardReset(calledFromStart = false) {
    const closedSessionId = this._sessionId;

    // ── 1. Invalidate all pending async callbacks ─────────────────────────
    this._sessionId++;
    this.isModalOpen = false;

    if (calledFromStart) {
      console.log(
        `[PARO-LIFECYCLE] Defensive cleanup (invalidating session ${closedSessionId})`,
      );
    } else {
      console.log("[PARO-LIFECYCLE] CLOSE");
      console.log(`[PARO-SESSION] INVALIDATED: ${closedSessionId}`);
    }

    // ── 2. Cancel restart timer before nulling recognition ────────────────
    if (this.restartDelayTimer) {
      clearTimeout(this.restartDelayTimer);
      this.restartDelayTimer = null;
    }

    // ── 3. Null and abort SpeechRecognition ──────────────────────────────
    // We null this.recognition BEFORE abort() so that isLive() inside any
    // concurrently-firing onend returns false immediately.
    if (this.recognition) {
      const dyingInstance = this.recognition;

      // Detach all event handlers from the dying instance first.
      dyingInstance.onstart = null;
      dyingInstance.onresult = null;
      dyingInstance.onerror = null;
      dyingInstance.onend = null;

      // Null the live reference BEFORE abort().
      this.recognition = null;

      try {
        dyingInstance.abort();
        console.log("[PARO-RECOGNITION] ABORT");
      } catch (e) {
        // Already stopped — ignore.
      }
      // NOTE: Do NOT call stop() after abort(). abort() is sufficient.
    }

    this.isListening = false;
    this.isRecognitionRunning = false;

    // ── 4. Stop microphone hardware streams ──────────────────────────────
    if (this.microphoneStream) {
      try {
        this.microphoneStream.getTracks().forEach((track) => track.stop());
        console.log("[PARO-MIC] STOP");
      } catch (e) {}
      this.microphoneStream = null;
    }

    // ── 5. Cancel speech synthesis ────────────────────────────────────────
    voiceService.stopSpeaking();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        console.log("[PARO-TTS] CANCEL");
      } catch (e) {}
    }

    // ── 6. Clear command timeout timer ────────────────────────────────────
    if (this.commandTimeoutTimer) {
      clearTimeout(this.commandTimeoutTimer);
      this.commandTimeoutTimer = null;
    }
    console.log("[PARO-LIFECYCLE] Timers cleared");

    // ── 7. Abort pending API requests ─────────────────────────────────────
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch (e) {}
      this.activeAbortController = null;
      console.log("[PARO-LIFECYCLE] Pending command cancelled");
    }

    // ── 8. Reset state directly (not via setState to avoid mid-teardown UI) ─
    this.state = "idle";
    this.debugInfo.lastTranscript = "None";
    this.debugInfo.command = "None";
    this.debugInfo.matchedSong = "None";
    this.debugInfo.player = "IDLE";
    this.debugInfo.voice = "IDLE";
    console.log("[PARO-STATE] reset -> idle");

    // ── 9. Emit close event only for explicit user close ──────────────────
    if (!calledFromStart) {
      this.notifyListeners({ type: "close", state: "idle" });
    }
  }

  // Aliases for backwards compatibility
  createNewSession(playerState, playerControls) {
    return this.startParoSession(playerState, playerControls);
  }
  terminateSession() {
    this.stopParoSession();
  }

  initVisibilityHandler() {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.stopRecognitionSafely();
      } else if (document.visibilityState === "visible") {
        if (
          supportsContinuousWakeWord &&
          this.isWakeListenerActive &&
          this.state === "idle" &&
          this.isModalOpen
        ) {
          this.startRecognitionSafely();
        }
      }
    });
  }

  initPythonVoiceWebSocket() {
    if (typeof window === "undefined") return;
    console.log(
      "[PARO WS] Connecting to Python Voice Service ws://127.0.0.1:5050/ws/paro...",
    );
    try {
      this.ws = new WebSocket("ws://127.0.0.1:5050/ws/paro");
      this.ws.onopen = () => {
        console.log("[PARO WS] Python Voice Microservice CONNECTED!");
        this.isWsConnected = true;
        this.reconnectAttempts = 0;
        this.debugInfo.pythonVoiceService = "CONNECTED";
        this.debugInfo.speechRecognition = "PYTHON_WS";
        this.debugInfo.microphone = "AVAILABLE";
        this.debugInfo.permission = "GRANTED";
        this.notifyListeners({ type: "python_status", connected: true });
      };
      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handlePythonVoiceEvent(payload);
        } catch (err) {
          console.warn("[PARO WS] Malformed WS payload:", event.data);
        }
      };
      this.ws.onerror = (err) => {
        console.warn("[PARO WS WARN] Python voice WebSocket error:", err);
        this.isWsConnected = false;
        this.debugInfo.pythonVoiceService = "DISCONNECTED";
      };
      this.ws.onclose = () => {
        console.log("[PARO WS] Connection closed. Attempting reconnect...");
        this.isWsConnected = false;
        this.debugInfo.pythonVoiceService = "DISCONNECTED";
        this.notifyListeners({ type: "python_status", connected: false });
        this.scheduleWsReconnect();
      };
    } catch (err) {
      console.warn("[PARO WS EXCEPTION]", err.message);
      this.isWsConnected = false;
      this.debugInfo.pythonVoiceService = "DISCONNECTED";
      this.scheduleWsReconnect();
    }
  }

  startHealthCheckPolling() {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5050/health", {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok") {
            if (!this.isWsConnected) {
              this.initPythonVoiceWebSocket();
            }
          }
        } else {
          this.debugInfo.pythonVoiceService = "DISCONNECTED";
        }
      } catch (err) {
        this.debugInfo.pythonVoiceService = "DISCONNECTED";
      }
    };
    checkHealth();
    setInterval(checkHealth, 5000);
  }

  scheduleWsReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );
    setTimeout(() => this.initPythonVoiceWebSocket(), delay);
  }

  handlePythonVoiceEvent(event) {
    if (!this.isModalOpen) return;
    if (event.type === "audio_metrics") {
      this.debugInfo.audioLevel = event.audioLevel || 0;
      this.debugInfo.vad = event.vad ? "YES" : "NO";
      if (event.clap) this.debugInfo.clap = "DETECTED";
      this.notifyListeners({
        type: "audio_metrics",
        audioLevel: event.audioLevel,
        vad: event.vad,
      });
    } else if (event.type === "clap_detected") {
      console.log("[PARO CLAP DETECTED] Clap triggered wake activation!");
      this.debugInfo.clap = "DETECTED";
      this.debugInfo.wakeWord = "CLAP_ACTIVATED";
      this.triggerWakeWordActivation();
    } else if (event.type === "wake_detected") {
      console.log("[PARO WAKE] WAKE WORD DETECTED FROM PYTHON SERVICE");
      this.triggerWakeWordActivation();
    } else if (event.type === "transcript" && event.text) {
      console.log(
        `[PARO TRANSCRIPT] "${event.text}" (Current state: ${this.state})`,
      );
      this.handleIncomingTranscript(event.text);
    } else if (event.type === "error") {
      this.debugInfo.lastError = event.message;
      this.notifyListeners({ type: "error", message: event.message });
    }
  }

  startRecognitionSafely() {
    if (!this.recognition) {
      console.log(
        "[PARO-RECOGNITION] startRecognitionSafely: no recognition instance — skipped",
      );
      return;
    }
    if (this.isWsConnected) {
      console.log(
        "[PARO-RECOGNITION] startRecognitionSafely: Python WS active — skipped",
      );
      return;
    }
    if (this.state === "speaking") {
      console.log(
        "[PARO-RECOGNITION] startRecognitionSafely: currently speaking — skipped",
      );
      return;
    }
    if (!this.isModalOpen) {
      console.log(
        "[PARO-RECOGNITION] startRecognitionSafely: modal not open — skipped",
      );
      return;
    }
    if (this.isRecognitionRunning) {
      console.log(
        "[PARO-RECOGNITION] startRecognitionSafely: already running — skipped",
      );
      return;
    }
    try {
      this.isRecognitionRunning = true;
      console.log("[PARO-RECOGNITION] START_REQUEST (safe restart)");
      this.recognition.start();
    } catch (err) {
      console.warn("[PARO-RECOGNITION] START EXCEPTION:", err.message);
      this.isRecognitionRunning = false;
    }
  }

  stopRecognitionSafely() {
    if (this.recognition) {
      try {
        this.recognition.stop();
        console.log("[PARO-RECOGNITION] STOP");
      } catch (err) {}
    }
    this.isListening = false;
    this.isRecognitionRunning = false;
  }

  handleIncomingTranscript(
    rawTranscript,
    playerStateOverride = null,
    playerControlsOverride = null,
  ) {
    if (
      !rawTranscript ||
      !rawTranscript.trim() ||
      this.state === "speaking" ||
      !this.isModalOpen
    )
      return;

    const playerState = playerStateOverride || this.latestPlayerState || {};
    const playerControls =
      playerControlsOverride || this.latestPlayerControls || {};

    const rawText = rawTranscript.trim();
    const wakeDetected = isWakeWord(rawText);

    if (this.state === "idle") {
      if (!supportsContinuousWakeWord && !wakeDetected) {
        console.log(
          `[PARO TAP-TO-TALK] Processing user voice command directly: "${rawText}"`,
        );
        this.processUserCommand(rawText, playerState, playerControls);
        return;
      }
      if (!wakeDetected) {
        console.log(
          `[PARO IDLE REJECT] Ignored speech while IDLE: "${rawText}"`,
        );
        this.debugInfo.lastTranscript = rawText;
        this.debugInfo.wakeWord = "NOT_DETECTED";
        this.notifyListeners({ type: "transcript_ignored", text: rawText });
        return;
      }
      console.log(`[PARO WAKE DETECTED] Wake phrase recognized: "${rawText}"`);
      this.debugInfo.wakeWord = "DETECTED";
      this.debugInfo.lastTranscript = rawText;
      this.triggerWakeWordActivation(playerState, playerControls);
      return;
    }

    if (this.state === "listening_for_command") {
      this.clearCommandTimeout();
      this.processUserCommand(rawText, playerState, playerControls);
      return;
    }
  }

  triggerWakeWordActivation(
    playerStateOverride = null,
    playerControlsOverride = null,
  ) {
    const playerState = playerStateOverride || this.latestPlayerState || {};
    const playerControls =
      playerControlsOverride || this.latestPlayerControls || {};

    this.stopRecognitionSafely();
    voiceService.stopSpeaking();
    this.clearCommandTimeout();
    this.setState("wake_detected");

    this.notifyListeners({ type: "wake_prompt", openPanel: true });

    const currentSong = playerState?.currentSong;
    let greetingText = "";

    if (currentSong && currentSong.title) {
      greetingText = pickRandom([
        `हाँ नितिन, अभी ${currentSong.title} चल रहा है। क्या करना है?`,
        `हाँ नितिन, ${currentSong.title} बज रहा है। बताओ, क्या करूँ?`,
      ]);
    } else {
      greetingText = pickRandom([
        "हाँ नितिन, बोलो... कौन सा गाना चलाऊँ?",
        "हाँ नितिन, बोलो ना... क्या सुनना है?",
        "जी नितिन, बताओ... कौन सा song चलाऊँ?",
        "हाँ, मैं सुन रही हूँ... क्या बजाऊँ?",
      ]);
    }

    this.speakParoReply(greetingText, () => {
      this.startListeningForCommand(playerState, playerControls);
    });
  }

  startListeningForCommand(playerState = {}, playerControls = {}) {
    const capturedSessionId = this._sessionId;
    this.setState("listening_for_command");
    this.clearCommandTimeout();

    this.latestPlayerState = playerState;
    this.latestPlayerControls = playerControls;

    this.startRecognitionSafely();

    this.commandTimeoutTimer = setTimeout(() => {
      if (capturedSessionId !== this._sessionId || !this.isModalOpen) return;
      if (this.state === "listening_for_command") {
        console.log("[PARO TIMEOUT] No command heard within 7 seconds.");
        const reply = "अरे, कुछ आवाज़ नहीं आई. जब सुनना हो, फिर से बताना.";
        this.notifyListeners({ type: "reply", reply });
        this.speakParoReply(reply, () => this.returnToIdle());
      }
    }, 7000);
  }

  async processUserCommand(commandText, playerState = {}, playerControls = {}) {
    const capturedSessionId = this._sessionId;
    if (
      !commandText ||
      !commandText.trim() ||
      capturedSessionId !== this._sessionId ||
      !this.isModalOpen
    ) {
      this.returnToIdle();
      return;
    }

    const rawCmd = commandText.trim();
    const normalizedCmd = normalizeTranscript(rawCmd);

    this.setState("processing");

    console.log("[PARO] Transcript:", rawCmd);
    console.log("[PARO] Normalized:", normalizedCmd);

    const parsedIntent = parseParoCommand(rawCmd);
    console.log("[PARO] Intent:", parsedIntent.intent);

    const t0 = Date.now();
    const currentSong = playerState?.currentSong;

    if (parsedIntent.intent === "CURRENT_SONG") {
      let reply = "अभी कोई गाना नहीं चल रहा है.";
      if (currentSong && currentSong.title) {
        reply = `हाँ नितिन, अभी ${currentSong.title}${currentSong.artist ? ` ${currentSong.artist} का` : ""} चल रहा है.`;
      }
      this.debugInfo.intent = "GET_CURRENT_SONG";
      this.debugInfo.latencyMs = Date.now() - t0;
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "PAUSE") {
      this.debugInfo.intent = "PAUSE";
      this.debugInfo.player = "PAUSED";
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.pauseSong) playerControls.pauseSong();
      const reply = pickRandom([
        "ठीक है, pause कर दिया.",
        "Okay, music रोक दिया.",
      ]);
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "RESUME") {
      this.debugInfo.intent = "RESUME";
      this.debugInfo.player = "PLAYING";
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.resumeSong) playerControls.resumeSong();
      const reply = pickRandom([
        "हाँ, फिर से चला रही हूँ.",
        "चलो, music फिर से शुरू करते हैं.",
      ]);
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "NEXT") {
      this.debugInfo.intent = "NEXT_TRACK";
      this.debugInfo.player = "NEXT";
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.playNext) playerControls.playNext();
      const reply = pickRandom([
        "Okay, next song चला रही हूँ.",
        "चलो, अगला गाना सुनते हैं.",
      ]);
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "PREVIOUS") {
      this.debugInfo.intent = "PREVIOUS_TRACK";
      this.debugInfo.player = "PREVIOUS";
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.playPrevious) playerControls.playPrevious();
      const reply = "ठीक है, पिछला गाना चला रही हूँ.";
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "VOLUME_UP") {
      this.debugInfo.intent = "VOLUME_UP";
      if (playerControls.setVolume)
        playerControls.setVolume(
          Math.min(1.0, (playerState.volume || 0.8) + 0.2),
        );
      const reply = "Volume बढ़ा दिया.";
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "VOLUME_DOWN") {
      this.debugInfo.intent = "VOLUME_DOWN";
      if (playerControls.setVolume)
        playerControls.setVolume(
          Math.max(0.0, (playerState.volume || 0.8) - 0.2),
        );
      const reply = "Volume कम कर दिया.";
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "MUTE") {
      this.debugInfo.intent = "MUTE";
      if (playerControls.toggleMute) playerControls.toggleMute();
      const reply = "Mute कर दिया.";
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "UNMUTE") {
      this.debugInfo.intent = "UNMUTE";
      if (playerControls.toggleMute) playerControls.toggleMute();
      const reply = "Unmute कर दिया.";
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }
    if (parsedIntent.intent === "NON_MUSIC_QUERY") {
      const reply =
        "हम्म... मैं एक music assistant हूँ! बताओ, कौन सा गाना बजाऊँ?";
      this.notifyListeners({ type: "reply", reply });
      this.speakParoReply(reply, () => this.returnToIdle());
      return;
    }

    const searchQuery = parsedIntent.query || rawCmd;
    console.log("[PARO] Search query:", searchQuery);

    this.setState("executing");
    this.activeAbortController = new AbortController();

    try {
      const result = await sendParoCommandApi(
        searchQuery,
        playerState,
        ++this.latestRequestId,
      );

      if (capturedSessionId !== this._sessionId || !this.isModalOpen) {
        console.log("[PARO] Command API response ignored (session terminated)");
        return;
      }

      const songList = result?.songs || [];
      console.log("[PARO] Search results:", songList.length);

      if (songList.length > 0 && playerControls.playSong) {
        const firstSong = songList[0];
        const remainingSongs = songList.slice(1);
        console.log("[PARO] Selected:", firstSong.title);
        this.debugInfo.matchedSong = firstSong.title;
        this.debugInfo.matchedArtist = firstSong.artist || "Unknown";
        this.debugInfo.player = `PLAYING "${firstSong.title}"`;
        playerControls.playSong(firstSong, remainingSongs);
        const replyText = pickRandom([
          `हाँ, ${firstSong.title} चला रही हूँ.`,
          `Okay नितिन, ${firstSong.title} बजा रही हूँ.`,
          `मिल गया! ${firstSong.title} चला रही हूँ.`,
        ]);
        this.notifyListeners({ type: "reply", reply: replyText, result });
        this.speakParoReply(replyText, () => this.returnToIdle());
      } else {
        const replyText = pickRandom([
          "अरे, ये गाना नहीं मिला.",
          "हम्म... ये song मुझे नहीं मिला.",
          "ओह, ये गाना नहीं मिल रहा. कुछ और try करें?",
        ]);
        this.debugInfo.player = "NOT_FOUND";
        this.notifyListeners({ type: "reply", reply: replyText, result });
        this.speakParoReply(replyText, () => this.returnToIdle());
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.log(
          "[PARO] Search API request aborted cleanly on session close.",
        );
        return;
      }
      console.error("[PARO COMMAND EXEC ERROR]", err);
      if (capturedSessionId !== this._sessionId) return;
      this.debugInfo.lastError = err.message;
      const replyText =
        "गाना मिल गया, लेकिन अभी play नहीं हो पाया. एक बार फिर try करते हैं.";
      this.notifyListeners({ type: "error", message: replyText });
      this.speakParoReply(replyText, () => this.returnToIdle());
    }
  }

  speakParoReply(replyText, onComplete = null) {
    const capturedSessionId = this._sessionId;
    console.log("[PARO-TTS] START:", replyText);

    if (!replyText || capturedSessionId !== this._sessionId) {
      if (onComplete && capturedSessionId === this._sessionId) onComplete();
      return;
    }

    this.stopRecognitionSafely();
    this.setState("speaking");
    this.debugInfo.voice = `SPEAKING ("${replyText}")`;

    const handleSpeechEnd = () => {
      console.log("[PARO-TTS] END");
      if (capturedSessionId !== this._sessionId || !this.isModalOpen) {
        console.log("[PARO-TTS] Completion ignored (session terminated)");
        return;
      }
      this.debugInfo.voice = "IDLE";
      setTimeout(() => {
        if (
          capturedSessionId === this._sessionId &&
          this.isModalOpen &&
          onComplete
        ) {
          onComplete();
        }
      }, 300);
    };

    if (this.isWsConnected) {
      fetch("http://127.0.0.1:5050/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      })
        .then(() => handleSpeechEnd())
        .catch(() => {
          voiceService.speak(replyText, null, handleSpeechEnd);
        });
    } else {
      voiceService.speak(replyText, null, handleSpeechEnd);
    }
  }

  clearCommandTimeout() {
    if (this.commandTimeoutTimer) {
      clearTimeout(this.commandTimeoutTimer);
      this.commandTimeoutTimer = null;
    }
  }

  returnToIdle() {
    if (!this.isModalOpen) return;
    this.clearCommandTimeout();
    this.setState("idle");
    if (
      supportsContinuousWakeWord &&
      !this.isWsConnected &&
      this.recognition &&
      this.isWakeListenerActive
    ) {
      this.startRecognitionSafely();
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ type: "state", state: this.state, debug: this.debugInfo });
    return () => this.listeners.delete(listener);
  }

  notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener({ ...data, debug: this.debugInfo });
      } catch (err) {
        console.error("[PARO ERROR]", err);
      }
    }
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[PARO-STATE] ${oldState} -> ${newState}`);
    this.notifyListeners({ type: "state", state: newState });
  }

  async startWakeListener() {
    this.isWakeListenerActive = true;
    if (this.isModalOpen) {
      this.returnToIdle();
    }
  }

  async startListening(playerState = {}, playerControls = {}) {
    voiceService.stopSpeaking();
    this.latestPlayerState = playerState;
    this.latestPlayerControls = playerControls;

    if (supportsMicrophone && navigator.mediaDevices) {
      try {
        console.log("[PARO-MIC] START");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        this.permissionState = "granted";
        this.debugInfo.permission = "GRANTED";
        this.microphoneStream = stream;
        stream.getTracks().forEach((track) => track.stop());
        console.log("[PARO-MIC] STOP");
      } catch (err) {
        console.warn("[PARO MIC PERMISSION WARN]", err.message);
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          this.permissionState = "denied";
          this.debugInfo.permission = "DENIED";
          this.setState("error");
          this.notifyListeners({
            type: "error",
            message:
              "Microphone access is blocked. Please enable Microphone permission in settings.",
          });
          return;
        }
      }
    }

    if (!supportsSpeechRecognition && !this.isWsConnected) {
      this.setState("error");
      this.notifyListeners({
        type: "error",
        message:
          "Speech recognition is not supported in this browser. Please use text input.",
      });
      return;
    }

    this.startListeningForCommand(playerState, playerControls);
  }

  stopListening() {
    voiceService.stopSpeaking();
    this.clearCommandTimeout();
    this.stopRecognitionSafely();
    this.returnToIdle();
  }

  // Expose sessionId read-only for external diagnostics
  get sessionId() {
    return this._sessionId;
  }
}

export const paroVoiceEngine = new PAROVoiceEngine();
export default paroVoiceEngine;
