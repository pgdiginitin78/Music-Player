import { sendParoCommandApi } from './api.js';
import voiceService from './VoiceService.js';

class PAROVoiceEngine {
  constructor() {
    this.ws = null;
    this.isWsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;

    this.recognition = null;
    this.isListening = false;
    this.isWakeListenerActive = true;
    this.listeningMode = 'wake'; // 'wake' or 'command'
    this.state = 'idle'; // idle, wake_listening, wake_detected, listening_for_command, processing, understanding, executing, speaking, error
    this.permissionState = 'unknown';

    this.commandTimeoutTimer = null;
    this.restartDelayTimer = null;

    // Real Diagnostic Panel Data
    this.debugInfo = {
      pythonVoiceService: 'DISCONNECTED', // DISCONNECTED | CONNECTED
      microphone: 'UNKNOWN',              // UNKNOWN | AVAILABLE | FAILED
      permission: 'UNKNOWN',              // UNKNOWN | GRANTED | DENIED
      speechRecognition: 'NOT_INITIALIZED', // NOT_INITIALIZED | READY | LISTENING | PYTHON_WS | ERROR
      lastTranscript: 'None',
      wakeWord: 'NOT_DETECTED',           // NOT_DETECTED | DETECTED
      command: 'None',
      intent: 'NONE',
      search: 'NONE',
      matchedSong: 'None',
      player: 'IDLE',
      voice: 'IDLE',
      lastError: null,
      latencyMs: 0,
    };

    this.listeners = new Set();
    this.latestRequestId = 0;
    this.activeAbortController = null;

    this.initPythonVoiceWebSocket();
    this.initBrowserEngineFallback();
    this.startHealthCheckPolling();
  }

  /**
   * Connects to Python Voice Microservice WebSocket (ws://127.0.0.1:5050/ws/paro)
   */
  initPythonVoiceWebSocket() {
    if (typeof window === 'undefined') return;

    console.log('[PARO WS] Connecting to Python Voice Service ws://127.0.0.1:5050/ws/paro...');
    
    try {
      this.ws = new WebSocket('ws://127.0.0.1:5050/ws/paro');

      this.ws.onopen = () => {
        console.log('[PARO WS] Python Voice Microservice CONNECTED!');
        this.isWsConnected = true;
        this.reconnectAttempts = 0;
        this.debugInfo.pythonVoiceService = 'CONNECTED';
        this.debugInfo.speechRecognition = 'PYTHON_WS';
        this.debugInfo.microphone = 'AVAILABLE';
        this.debugInfo.permission = 'GRANTED';
        this.notifyListeners({ type: 'python_status', connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handlePythonVoiceEvent(payload);
        } catch (err) {
          console.warn('[PARO WS] Malformed WS payload:', event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[PARO WS WARN] Python voice WebSocket error:', err);
        this.isWsConnected = false;
        this.debugInfo.pythonVoiceService = 'DISCONNECTED';
      };

      this.ws.onclose = () => {
        console.log('[PARO WS] Connection closed. Attempting reconnect...');
        this.isWsConnected = false;
        this.debugInfo.pythonVoiceService = 'DISCONNECTED';
        this.notifyListeners({ type: 'python_status', connected: false });
        this.scheduleWsReconnect();
      };
    } catch (err) {
      console.warn('[PARO WS EXCEPTION]', err.message);
      this.isWsConnected = false;
      this.debugInfo.pythonVoiceService = 'DISCONNECTED';
      this.scheduleWsReconnect();
    }
  }

  startHealthCheckPolling() {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5050/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') {
            if (!this.isWsConnected) {
              // Try connecting WebSocket if HTTP health is OK but WS is not connected
              this.initPythonVoiceWebSocket();
            }
          }
        } else {
          this.debugInfo.pythonVoiceService = 'DISCONNECTED';
        }
      } catch (err) {
        this.debugInfo.pythonVoiceService = 'DISCONNECTED';
      }
    };

    checkHealth();
    setInterval(checkHealth, 5000);
  }

  scheduleWsReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    console.log(`[PARO WS] Reconnecting to Python service in ${delay}ms...`);
    setTimeout(() => this.initPythonVoiceWebSocket(), delay);
  }

  /**
   * Handles incoming structured Python Voice Events
   */
  handlePythonVoiceEvent(event) {
    console.log('[PARO WS EVENT]', event);

    if (event.type === 'audio_metrics') {
      this.debugInfo.audioLevel = event.audioLevel || 0;
      this.debugInfo.vad = event.vad ? 'YES' : 'NO';
      if (event.clap) this.debugInfo.clap = 'DETECTED';
      this.notifyListeners({ type: 'audio_metrics', audioLevel: event.audioLevel, vad: event.vad });
    } else if (event.type === 'clap_detected') {
      console.log('[PARO CLAP DETECTED] Clap triggered activation!');
      this.debugInfo.clap = 'DETECTED';
      this.debugInfo.wakeWord = 'CLAP_ACTIVATED';
      this.notifyListeners({ type: 'wake_prompt', openPanel: true });
      this.setState('wake_detected');
    } else if (event.type === 'voice_status') {
      if (event.state === 'WAKE_LISTENING') this.setState('wake_listening');
      else if (event.state === 'COMMAND_LISTENING') this.setState('listening_for_command');
      else if (event.state === 'PROCESSING') this.setState('processing');
      else if (event.state === 'SPEAKING') this.setState('speaking');
    } else if (event.type === 'wake_detected') {
      console.log('[PARO 07] WAKE WORD DETECTED FROM PYTHON SERVICE');
      this.debugInfo.wakeWord = 'DETECTED';
      this.notifyListeners({ type: 'wake_prompt', openPanel: true });
      this.setState('wake_detected');
    } else if (event.type === 'transcript' && event.text) {
      console.log(`[PARO 06] Transcript received from Python Voice: "${event.text}"`);
      this.debugInfo.lastTranscript = event.text;
      this.notifyListeners({ type: 'transcript', text: event.text });
      this.handleFinalTranscript(event.text);
    } else if (event.type === 'no_speech') {
      if (typeof event.audioLevel === 'number') {
        this.debugInfo.audioLevel = event.audioLevel;
      }
      if (this.state !== 'speaking' && this.state !== 'processing') {
        this.setState('wake_listening');
      }
    } else if (event.type === 'error') {
      this.debugInfo.lastError = event.message;
      this.notifyListeners({ type: 'error', message: event.message });
    }
  }

  /**
   * Browser Speech Recognition Fallback (used if Python is offline)
   */
  initBrowserEngineFallback() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (!this.isWsConnected) {
        this.debugInfo.microphone = 'FAILED';
        this.debugInfo.speechRecognition = 'ERROR';
      }
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';

      this.debugInfo.microphone = 'AVAILABLE';

      this.recognition.onstart = () => {
        if (!this.isWsConnected) {
          this.isListening = true;
          this.permissionState = 'granted';
          this.debugInfo.permission = 'GRANTED';
          this.debugInfo.microphone = 'AVAILABLE';
          this.debugInfo.speechRecognition = 'LISTENING';
          this.setState(this.listeningMode === 'wake' ? 'wake_listening' : 'listening_for_command');
        }
      };

      this.recognition.onresult = (event) => {
        if (this.isWsConnected) return; // Python WebSocket handles voice when connected

        let interimText = '';
        let finalDone = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          interimText += res[0].transcript;
          if (res.isFinal) finalDone = true;
        }

        const cleanInterim = interimText.trim();
        if (!cleanInterim) return;

        this.debugInfo.lastTranscript = cleanInterim;
        this.notifyListeners({ type: 'transcript', text: cleanInterim });

        if (this.listeningMode === 'wake') {
          this.evaluateWakeWordBrowser(cleanInterim, finalDone);
        } else if (finalDone && cleanInterim) {
          this.handleFinalTranscript(cleanInterim);
        }
      };

      this.recognition.onerror = (event) => {
        if (!this.isWsConnected) {
          this.isListening = false;
          // Filter out routine no-speech silence from red error display
          if (event.error !== 'no-speech') {
            this.debugInfo.lastError = event.error;
          }
          if (event.error === 'not-allowed') {
            this.permissionState = 'denied';
            this.debugInfo.permission = 'DENIED';
          }
        }
      };

      this.recognition.onend = () => {
        if (!this.isWsConnected) {
          this.isListening = false;
          if (this.isWakeListenerActive && this.state !== 'speaking' && this.permissionState === 'granted') {
            setTimeout(() => {
              if (!this.isListening) try { this.recognition.start(); } catch (e) {}
            }, 400);
          }
        }
      };
    } catch (err) {
      console.warn('[PARO BROWSER FALLBACK WARN]', err.message);
    }
  }

  evaluateWakeWordBrowser(transcript = '', isFinal = false) {
    const norm = transcript.toLowerCase().trim();
    const wakeWordRegex = /\b(hey|hi|hello)?\s*(paro|pero|paroh)\b/i;

    if (!wakeWordRegex.test(norm)) return;

    this.debugInfo.wakeWord = 'DETECTED';
    this.setState('wake_detected');

    const commandAfterWake = norm.replace(wakeWordRegex, '').replace(/^[\s,\.\-]+/, '').trim();

    if (commandAfterWake && commandAfterWake.length >= 3) {
      this.handleFinalTranscript(commandAfterWake);
    } else if (isFinal) {
      this.activateParoPrompt();
    }
  }

  activateParoPrompt() {
    voiceService.stopSpeaking();
    this.notifyListeners({ type: 'wake_prompt', openPanel: true });

    this.debugInfo.voice = 'SPEAKING ("Yes?")';
    voiceService.speak(
      'Yes?',
      () => this.setState('speaking'),
      () => {
        this.debugInfo.voice = 'READY';
        this.listeningMode = 'command';
        this.startListeningForCommand();
      }
    );
  }

  startListeningForCommand() {
    this.setState('listening_for_command');
    this.listeningMode = 'command';

    if (!this.isWsConnected && this.recognition) {
      try { this.recognition.start(); } catch (err) {}
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ type: 'state', state: this.state, debug: this.debugInfo });
    return () => this.listeners.delete(listener);
  }

  notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener({ ...data, debug: this.debugInfo });
      } catch (err) {
        console.error('[PARO ERROR]', err);
      }
    }
  }

  setState(newState) {
    this.state = newState;
    this.notifyListeners({ type: 'state', state: newState });
  }

  async startWakeListener() {
    this.isWakeListenerActive = true;
    this.listeningMode = 'wake';
    if (!this.isWsConnected && this.recognition && !this.isListening) {
      try { this.recognition.start(); } catch (err) {}
    }
  }

  async startListening(playerState = {}, playerControls = {}) {
    voiceService.stopSpeaking();

    this.latestPlayerState = playerState;
    this.latestPlayerControls = playerControls;

    if (!this.isWsConnected && this.recognition) {
      try {
        if (navigator.mediaDevices) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        }
        this.permissionState = 'granted';
        this.debugInfo.permission = 'GRANTED';
        this.recognition.start();
      } catch (err) {
        this.setState('error');
      }
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try { this.recognition.stop(); } catch (err) {}
    }
    this.isListening = false;
    this.setState('idle');
  }

  speakParoReply(replyText) {
    if (!replyText) return;
    this.debugInfo.voice = `SPEAKING ("${replyText}")`;
    
    // Call Python TTS via POST endpoint if WS connected, else fallback to VoiceService
    if (this.isWsConnected) {
      fetch('http://127.0.0.1:5050/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText }),
      }).catch(() => {
        voiceService.speak(replyText);
      });
    } else {
      voiceService.speak(replyText);
    }
  }

  async handleFinalTranscript(transcript, playerStateOverride = null, playerControlsOverride = null) {
    if (!transcript || !transcript.trim()) return;

    const norm = transcript.toLowerCase().trim();
    if (/^\b(hey|hi|hello)?\s*(paro|pero|paroh)\b$/i.test(norm)) {
      this.activateParoPrompt();
      return;
    }

    const currentReqId = ++this.latestRequestId;
    const t0 = Date.now();
    const cleanTranscript = transcript.trim();

    this.debugInfo.command = cleanTranscript;
    this.setState('processing');

    const playerState = playerStateOverride || this.latestPlayerState || {};
    const playerControls = playerControlsOverride || this.latestPlayerControls || {};

    // 1. Level 1 Client-Side Fast Controls (<50ms)
    const lower = cleanTranscript.toLowerCase();

    if (/\b(time|what time|what is the time)\b/.test(lower)) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const reply = `It's ${nowStr}.`;
      this.debugInfo.intent = 'GET_TIME';
      this.debugInfo.latencyMs = Date.now() - t0;
      this.notifyListeners({ type: 'reply', reply });
      this.speakParoReply(reply);
      return;
    }

    if (/\b(pause|stop)\b/.test(lower)) {
      this.debugInfo.intent = 'CONTROL_PLAYER';
      this.debugInfo.action = 'PAUSE';
      this.debugInfo.player = 'PAUSED';
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.pauseSong) playerControls.pauseSong();
      this.notifyListeners({ type: 'reply', reply: 'Paused playback.' });
      this.speakParoReply('Paused playback.');
      return;
    }

    if (/\b(resume|play|start)\b/.test(lower) && lower.length < 15) {
      this.debugInfo.intent = 'CONTROL_PLAYER';
      this.debugInfo.action = 'PLAY';
      this.debugInfo.player = 'PLAYING';
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.resumeSong) playerControls.resumeSong();
      this.notifyListeners({ type: 'reply', reply: 'Resuming playback.' });
      this.speakParoReply('Resuming playback.');
      return;
    }

    if (/\b(skip|next|next song)\b/.test(lower)) {
      this.debugInfo.intent = 'CONTROL_PLAYER';
      this.debugInfo.action = 'SKIP';
      this.debugInfo.player = 'NEXT_TRACK';
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.playNext) playerControls.playNext();
      this.notifyListeners({ type: 'reply', reply: 'Skipping to next track.' });
      this.speakParoReply('Skipping to next track.');
      return;
    }

    if (/\b(previous|go back|last song)\b/.test(lower)) {
      this.debugInfo.intent = 'CONTROL_PLAYER';
      this.debugInfo.action = 'PREVIOUS';
      this.debugInfo.player = 'PREVIOUS_TRACK';
      this.debugInfo.latencyMs = Date.now() - t0;
      if (playerControls.playPrevious) playerControls.playPrevious();
      this.notifyListeners({ type: 'reply', reply: 'Playing previous track.' });
      this.speakParoReply('Playing previous track.');
      return;
    }

    // 2. Level 2 / Level 3 Fast Server Command Execution
    this.setState('understanding');
    this.activeAbortController = new AbortController();

    try {
      const result = await sendParoCommandApi(
        cleanTranscript,
        playerState,
        currentReqId,
        this.activeAbortController.signal
      );

      if (currentReqId !== this.latestRequestId) return;

      this.setState('executing');
      this.debugInfo.latencyMs = Date.now() - t0;
      this.debugInfo.intent = result.intent?.intent || result.intent?.mode || 'PLAY_MUSIC';
      this.debugInfo.action = result.actions?.[0]?.type || 'NONE';

      if (result.match) {
        this.debugInfo.search = `MATCH: ${result.match.matchType}`;
        this.debugInfo.matchedSong = result.match.songTitle || 'None';
        this.debugInfo.matchedArtist = result.match.artist || 'None';
        this.debugInfo.matchedTrackId = result.match.trackId || 'None';
        this.debugInfo.matchedDuration = result.match.duration || 0;
        this.debugInfo.playbackSource = result.match.playbackSource || 'FULL_TRACK';
      }

      const replyText = result.reply || "I've got you. Starting music for you.";
      this.notifyListeners({ type: 'reply', reply: replyText, result });

      // Execute returned player actions automatically
      if (Array.isArray(result.actions) && playerControls && result.actions.length > 0) {
        for (const action of result.actions) {
          if (action.type === 'PLAY_RECOMMENDED_QUEUE' || action.type === 'SEARCH_AND_PLAY') {
            if (result.songs && result.songs.length > 0 && playerControls.playSong) {
              const firstSong = result.songs[0];
              const remaining = result.songs.slice(1);

              console.log(`[PARO PLAYER EXEC] Playing requested song: "${firstSong.title}" (${firstSong.artist})`);
              this.debugInfo.matchedSong = firstSong.title;
              this.debugInfo.matchedArtist = firstSong.artist || 'Unknown';
              this.debugInfo.matchedTrackId = firstSong.youtubeVideoId || firstSong.id || 'None';
              this.debugInfo.matchedDuration = firstSong.duration || 0;
              this.debugInfo.playbackSource = (firstSong.duration && firstSong.duration >= 90) ? 'FULL_TRACK' : 'PREVIEW';

              playerControls.playSong(firstSong, remaining);
              this.debugInfo.player = `PLAYING "${firstSong.title}"`;
            }
          } else if (action.type === 'PAUSE_SONG' && playerControls.pauseSong) {
            playerControls.pauseSong();
            this.debugInfo.player = 'PAUSED';
          } else if (action.type === 'RESUME_SONG' && playerControls.resumeSong) {
            playerControls.resumeSong();
            this.debugInfo.player = 'PLAYING';
          } else if (action.type === 'SKIP_SONG' && playerControls.playNext) {
            playerControls.playNext();
            this.debugInfo.player = 'SKIPPED';
          } else if (action.type === 'PREVIOUS_SONG' && playerControls.playPrevious) {
            playerControls.playPrevious();
            this.debugInfo.player = 'PREVIOUS';
          }
        }
      } else if (result.intent?.intent === 'PLAY_EXACT_SONG') {
        this.debugInfo.player = 'NOT_FOUND';
      }

      this.speakParoReply(replyText);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[PARO VOICE PROCESS ERROR]', err);
        this.debugInfo.lastError = err.message;
        this.debugInfo.player = 'ERROR';
        this.notifyListeners({ type: 'error', message: `I couldn't process that: ${err.message}` });
        this.setState('error');
      }
    }
  }
}

export const paroVoiceEngine = new PAROVoiceEngine();
export default paroVoiceEngine;
