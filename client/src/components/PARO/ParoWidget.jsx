import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useMusic } from '../../context/MusicContext.jsx';
import paroVoiceEngine from '../../services/PAROVoiceEngine.js';
import voiceService from '../../services/VoiceService.js';

// Local Flaticon SVG Assets
import paroIcon from '../../assets/paro/icons/paro.svg';
import microphoneIcon from '../../assets/paro/icons/microphone.svg';
import playIcon from '../../assets/paro/icons/play.svg';
import trendingIcon from '../../assets/paro/icons/trending.svg';
import musicIcon from '../../assets/paro/icons/music.svg';
import sendIcon from '../../assets/paro/icons/send.svg';
import closeIcon from '../../assets/paro/icons/close.svg';
import errorIcon from '../../assets/paro/icons/error.svg';
import loadingIcon from '../../assets/paro/icons/loading.svg';

const QUICK_ACTION_BUTTONS = [
  { label: 'Play something', text: 'Play something good', icon: playIcon },
  { label: 'Trending', text: 'Play trending songs', icon: trendingIcon },
  { label: 'New music', text: 'Play new Hindi releases', icon: musicIcon },
];

export default function ParoWidget() {
  const { theme } = useTheme();
  const { currentSong, playSong, pauseSong, resumeSong, playNext, playPrevious, audioState } = useMusic();

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [textInput, setTextInput] = useState('');
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(import.meta.env.DEV || false);

  const playerControlsRef = useRef({ playSong, pauseSong, resumeSong, playNext, playPrevious });
  playerControlsRef.current = { playSong, pauseSong, resumeSong, playNext, playPrevious };

  const getPlayerState = () => ({
    currentSong: currentSong ? {
      title: currentSong.title,
      artist: currentSong.artist,
      category: currentSong.category,
      youtubeVideoId: currentSong.youtubeVideoId || currentSong.id,
    } : null,
    isPlaying: audioState === 'playing',
  });

  useEffect(() => {
    paroVoiceEngine.startWakeListener();

    const unsubscribe = paroVoiceEngine.subscribe((event) => {
      if (event.type === 'state') {
        setState(event.state);
        if (event.state !== 'error') setErrorMessage('');
      } else if (event.type === 'wake_prompt') {
        setIsOpen(true);
        setErrorMessage('');
      } else if (event.type === 'transcript') {
        setTranscript(event.text);
      } else if (event.type === 'reply') {
        setLastReply(event.reply);
      } else if (event.type === 'error') {
        setErrorMessage(event.message || 'An error occurred.');
      }

      if (event.debug) {
        setDebugInfo(event.debug);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleMicTap = async () => {
    voiceService.stopSpeaking();
    setIsOpen(true);
    setErrorMessage('');
    setTranscript('');

    if (state === 'listening_for_command') {
      paroVoiceEngine.stopListening();
    } else {
      await paroVoiceEngine.startListening(getPlayerState(), playerControlsRef.current);
    }
  };

  const handleSendText = (textOverride) => {
    voiceService.stopSpeaking();
    const text = textOverride || textInput.trim();
    if (!text) return;

    setTranscript(text);
    setTextInput('');
    setErrorMessage('');
    setIsOpen(true);

    paroVoiceEngine.handleFinalTranscript(text, getPlayerState(), playerControlsRef.current);
  };

  const primaryColor = theme?.primary || 'rgba(139, 92, 246, 1)';
  const glowColor = theme?.glow || 'rgba(139, 92, 246, 0.4)';

  const getStateText = () => {
    switch (state) {
      case 'wake_listening': return 'Listening for "Hey PARO"...';
      case 'wake_detected': return 'Wake word detected!';
      case 'listening_for_command': return 'Listening for command... Speak now';
      case 'requesting_permission': return 'Allowing microphone...';
      case 'processing': return 'Processing speech...';
      case 'understanding': return 'Understanding intent...';
      case 'executing': return 'Executing music action...';
      case 'speaking': return 'PARO is speaking...';
      case 'error': return errorMessage || 'Error occurred';
      default: return 'Listening for "Hey PARO" or tap mic';
    }
  };

  return (
    <div className="fixed bottom-24 right-5 z-50 flex flex-col items-end pointer-events-none font-sans">
      {/* Floating Launcher Pill Button */}
      {!isOpen && (
        <button
          onClick={handleMicTap}
          aria-label="Open PARO Assistant"
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full text-white font-semibold text-sm shadow-2xl transition-all duration-300 border border-white/20 active:scale-95 group hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, rgba(30, 27, 75, 0.95))`,
            boxShadow: `0 8px 32px 0 ${glowColor}`,
          }}
        >
          <span
            className={`absolute inset-0 rounded-full transition-opacity duration-500 ${
              state === 'listening_for_command' || state === 'speaking' || state === 'wake_detected'
                ? 'animate-ping opacity-75'
                : 'opacity-30 group-hover:opacity-60'
            }`}
            style={{ backgroundColor: primaryColor }}
          />

          <div className="relative flex items-center gap-2">
            <img src={microphoneIcon} alt="" className="w-4 h-4 invert" />
            <span className="text-xs font-bold tracking-wide">PARO</span>
          </div>
        </button>
      )}

      {/* Main PARO Panel Card */}
      {isOpen && (
        <div className="pointer-events-auto w-80 sm:w-96 p-4 rounded-3xl bg-slate-950/95 backdrop-blur-2xl border border-violet-500/30 shadow-2xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={paroIcon} alt="" className="w-5 h-5 text-violet-400" style={{ filter: 'brightness(0) invert(1)' }} />
              <h3 className="text-sm font-bold text-white tracking-wide">Talk to PARO</h3>
            </div>
            <button
              onClick={() => {
                voiceService.stopSpeaking();
                setIsOpen(false);
              }}
              aria-label="Close PARO"
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition active:scale-95"
            >
              <img src={closeIcon} alt="" className="w-4 h-4 invert opacity-70 hover:opacity-100" />
            </button>
          </div>

          {/* Current Song Context Pill */}
          {currentSong && (
            <div className="px-3 py-1.5 rounded-xl bg-violet-900/30 border border-violet-500/20 flex items-center justify-between text-[11px] text-violet-200">
              <span className="truncate max-w-[220px]">
                <strong className="text-white">{currentSong.title}</strong> — {currentSong.artist}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                {audioState === 'playing' ? 'Playing' : 'Paused'}
              </span>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none py-0.5">
            {QUICK_ACTION_BUTTONS.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSendText(action.text)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-900 hover:bg-violet-900/40 border border-white/15 hover:border-violet-400/40 text-xs text-gray-200 hover:text-white flex items-center gap-1.5 transition active:scale-95"
              >
                <img src={action.icon} alt="" className="w-3.5 h-3.5 invert opacity-80" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Error Feedback Message Box */}
          {errorMessage && (
            <div className="px-3 py-2 rounded-xl bg-red-950/80 border border-red-500/40 flex items-center gap-2 text-xs text-red-200">
              <img src={errorIcon} alt="" className="w-4 h-4 invert opacity-90" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Live Transcript & Reply Feedback */}
          {(transcript || lastReply || state !== 'idle') && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-wider text-violet-400">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span>State: {state}</span>
              </div>

              {/* Transcript Display */}
              {transcript && (
                <div className="text-violet-200">
                  <span className="text-gray-400 font-semibold mr-1">You:</span>
                  <span className="italic">"{transcript}"</span>
                </div>
              )}

              {/* PARO Reply Display */}
              {lastReply && (
                <div className="text-white">
                  <span className="text-violet-400 font-semibold mr-1">PARO:</span>
                  <span className="font-medium">{lastReply}</span>
                </div>
              )}
            </div>
          )}

          {/* Text Input & Send Button */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Tell PARO what you want to hear..."
              className="flex-1 bg-slate-900/90 text-white text-xs px-3.5 py-2.5 rounded-2xl border border-white/15 focus:outline-none focus:border-violet-500 placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              aria-label="Send"
              className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95"
            >
              <img src={sendIcon} alt="" className="w-4 h-4 invert" />
            </button>
          </form>

          {/* Microphone Main Control Button & Concentric Rings Area */}
          <div className="flex flex-col items-center gap-2 pt-2 relative">
            <div className="relative flex items-center justify-center">
              
              {/* Animated Concentric Outer Rings (2-4 soft expanding rings mapped to real voice state) */}
              {(state === 'wake_listening' || state === 'listening_for_command' || state === 'wake_detected') && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`absolute w-14 h-14 rounded-full border border-violet-400/60 ${
                      state === 'listening_for_command' || state === 'wake_detected'
                        ? 'animate-paro-ring-fast-1'
                        : 'animate-paro-ring-1'
                    }`}
                    style={{ boxShadow: `0 0 20px ${glowColor}` }}
                  />
                  <div
                    className={`absolute w-14 h-14 rounded-full border border-violet-400/40 ${
                      state === 'listening_for_command' || state === 'wake_detected'
                        ? 'animate-paro-ring-fast-2'
                        : 'animate-paro-ring-2'
                    }`}
                    style={{ boxShadow: `0 0 16px ${glowColor}` }}
                  />
                  <div
                    className={`absolute w-14 h-14 rounded-full border border-violet-400/25 ${
                      state === 'listening_for_command' || state === 'wake_detected'
                        ? 'animate-paro-ring-fast-3'
                        : 'animate-paro-ring-3'
                    }`}
                  />
                </div>
              )}

              {/* Central Purple Microphone Button */}
              <button
                onClick={handleMicTap}
                aria-label="Toggle PARO Voice Microphone"
                className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-xl ${
                  state === 'listening_for_command' || state === 'wake_detected'
                    ? 'bg-violet-600 scale-105 ring-4 ring-violet-400/50'
                    : state === 'wake_listening'
                    ? 'bg-violet-600/90 animate-paro-breath'
                    : state === 'speaking'
                    ? 'bg-violet-700 ring-2 ring-violet-400/30'
                    : 'bg-violet-700 hover:bg-violet-600'
                }`}
                style={{ boxShadow: `0 0 24px ${glowColor}` }}
              >
                {state === 'requesting_permission' || state === 'processing' || state === 'understanding' ? (
                  <img src={loadingIcon} alt="" className="w-6 h-6 invert animate-spin" />
                ) : (
                  <img src={microphoneIcon} alt="" className="w-6 h-6 invert" />
                )}
              </button>
            </div>

            {/* Speaking Waveform Visualizer Animation */}
            {state === 'speaking' && (
              <div className="flex items-center gap-1 py-0.5">
                <span className="w-1 h-3.5 bg-violet-400 rounded-full animate-pulse" />
                <span className="w-1 h-5.5 bg-violet-300 rounded-full animate-pulse delay-75" />
                <span className="w-1 h-4 bg-violet-400 rounded-full animate-pulse delay-150" />
                <span className="w-1 h-2 bg-violet-500 rounded-full animate-pulse delay-200" />
              </div>
            )}

            <span className="text-[11px] font-medium text-gray-400">
              {getStateText()}
            </span>
          </div>

          {/* Real Phase 3 Diagnostic Panel (Collapsible) */}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-1 text-[10px] font-mono text-gray-400">
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="text-left text-violet-400 hover:underline font-semibold flex items-center justify-between"
            >
              <span>{showDebug ? '▼ HIDE PARO DIAGNOSTIC' : '▶ SHOW PARO DIAGNOSTIC'}</span>
              <span className="text-[9px] text-gray-500">DEV MODE</span>
            </button>

            {showDebug && (
              <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-1 text-[10px] font-mono">
                <div>Python Voice Service: <strong className={debugInfo.pythonVoiceService === 'CONNECTED' ? 'text-emerald-400' : 'text-red-400'}>{debugInfo.pythonVoiceService || 'DISCONNECTED'}</strong></div>
                <div>Microphone: <strong className={debugInfo.microphone === 'AVAILABLE' ? 'text-emerald-400' : 'text-red-400'}>{debugInfo.microphone || 'UNKNOWN'}</strong></div>
                <div>Permission: <strong className={debugInfo.permission === 'GRANTED' ? 'text-emerald-400' : 'text-amber-400'}>{debugInfo.permission || 'UNKNOWN'}</strong></div>
                <div>Audio Level: <span className="text-amber-300">{debugInfo.audioLevel || 0}%</span></div>
                <div>Voice Activity: <strong className={debugInfo.vad === 'YES' ? 'text-emerald-400' : 'text-gray-400'}>{debugInfo.vad || 'NO'}</strong></div>
                <div>Clap Detection: <strong className={debugInfo.clap === 'DETECTED' ? 'text-emerald-400' : 'text-gray-400'}>{debugInfo.clap || 'NOT_DETECTED'}</strong></div>
                <div>Speech recognition: <strong className="text-violet-300">{debugInfo.speechRecognition || 'NOT_INITIALIZED'}</strong></div>
                <div>Last transcript: <span className="text-gray-200">"{debugInfo.lastTranscript || transcript || 'None'}"</span></div>
                <div>Wake word: <strong className={debugInfo.wakeWord === 'DETECTED' ? 'text-emerald-400' : 'text-gray-400'}>{debugInfo.wakeWord || 'NOT_DETECTED'}</strong></div>
                <div>Command: <span className="text-white">{debugInfo.command || 'None'}</span></div>
                <div>Intent: <span className="text-emerald-300">{debugInfo.intent || 'NONE'}</span></div>
                <div>Search: <span className="text-violet-300">{debugInfo.search || 'NONE'}</span></div>
                <div>Matched song: <span className="text-emerald-300">{debugInfo.matchedSong || 'None'}</span></div>
                <div>Matched artist: <span className="text-emerald-300">{debugInfo.matchedArtist || 'None'}</span></div>
                <div>Track ID: <span className="text-gray-300">{debugInfo.matchedTrackId || 'None'}</span></div>
                <div>Duration: <span className="text-amber-300">{debugInfo.matchedDuration ? `${Math.floor(debugInfo.matchedDuration / 60)}:${String(debugInfo.matchedDuration % 60).padStart(2, '0')}` : '0:00'}</span></div>
                <div>Playback source: <strong className={debugInfo.playbackSource === 'FULL_TRACK' ? 'text-emerald-400' : 'text-amber-400'}>{debugInfo.playbackSource || 'FULL_TRACK'}</strong></div>
                <div>Player: <span className="text-cyan-300">{debugInfo.player || 'IDLE'}</span></div>
                <div>Voice: <span className="text-violet-300">{debugInfo.voice || 'IDLE'}</span></div>
                <div>Latency: <span className="text-amber-300">{debugInfo.latencyMs ? `${debugInfo.latencyMs}ms` : '0ms'}</span></div>
                
                {/* Voice Quality Preview Sample Controls */}
                <div className="pt-1 border-t border-white/10 flex flex-col gap-1">
                  <span className="text-violet-400 font-semibold">Test Natural Female Voice Preview:</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => voiceService.previewParoVoice("Hi, I'm PARO. What would you like to listen to?")}
                      className="px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800 text-white text-[9px]"
                    >
                      Greeting
                    </button>
                    <button
                      type="button"
                      onClick={() => voiceService.previewParoVoice("Sure, playing Ehsass.")}
                      className="px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800 text-white text-[9px]"
                    >
                      Playing Ehsass
                    </button>
                    <button
                      type="button"
                      onClick={() => voiceService.previewParoVoice("Playing something relaxing for you.")}
                      className="px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800 text-white text-[9px]"
                    >
                      Relaxing Mix
                    </button>
                    <button
                      type="button"
                      onClick={() => voiceService.previewParoVoice("Your music is ready.")}
                      className="px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800 text-white text-[9px]"
                    >
                      Ready
                    </button>
                  </div>
                </div>

                {debugInfo.lastError && debugInfo.lastError !== 'no-speech' && (
                  <div className="text-red-400">Last error: {debugInfo.lastError}</div>
                )}
                {debugInfo.pythonVoiceService !== 'CONNECTED' && (
                  <div className="text-amber-300 text-[9px] pt-1">
                    Tip: Run <code className="bg-white/10 px-1 py-0.5 rounded">paro_voice/start_voice_service.bat</code> to connect Python Voice Service.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
