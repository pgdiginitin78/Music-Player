import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext.jsx';
import { sendPulseMindChatMessage } from '../../services/api.js';

const QUICK_ACTIONS = [
  { label: '🎧 Play something', text: 'Play something good for me' },
  { label: '🔥 Trending', text: 'What songs are trending right now?' },
  { label: '✨ New music', text: 'Play fresh new release songs' },
  { label: '❤️ Romantic', text: 'Play romantic Hindi songs' },
  { label: '😌 Chill', text: 'Play something relaxing and chill' },
  { label: '⚡ Energetic', text: 'Make it more energetic!' },
  { label: '🔀 Surprise me', text: 'Surprise me with new music discovery' },
];

export default function PulseMindChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hey! I'm PulseMind AI, your music companion. How are you feeling today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState(null);

  const {
    currentSong,
    isPlaying,
    playSong,
    pauseSong,
    resumeSong,
    playNext,
    playPrevious,
    setQueue,
    audioState,
  } = useMusic();

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue.trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      const playerState = {
        currentSong: currentSong ? {
          title: currentSong.title,
          artist: currentSong.artist,
          category: currentSong.category,
          youtubeVideoId: currentSong.youtubeVideoId || currentSong.id,
        } : null,
        isPlaying: audioState === 'playing',
      };

      const res = await sendPulseMindChatMessage(text, playerState, sessionContext);

      if (res.sessionContext) {
        setSessionContext(res.sessionContext);
      }

      const aiReplyText = res.reply || "I've got you 🎧 Playing music for you.";
      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: aiReplyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reasons: res.songs?.[0]?.reasons || [],
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Execute Player Actions returned by PulseMind AI
      if (Array.isArray(res.actions)) {
        for (const action of res.actions) {
          if (action.type === 'PAUSE_SONG') {
            pauseSong();
          } else if (action.type === 'RESUME_SONG') {
            resumeSong();
          } else if (action.type === 'SKIP_SONG') {
            playNext();
          } else if (action.type === 'PREVIOUS_SONG') {
            playPrevious();
          } else if (action.type === 'PLAY_RECOMMENDED_QUEUE' || action.type === 'SEARCH_AND_PLAY') {
            if (res.songs && res.songs.length > 0) {
              const firstSong = res.songs[0];
              const remaining = res.songs.slice(1);
              playSong(firstSong, remaining);
            }
          }
        }
      }
    } catch (err) {
      console.error('[PULSEMIND CHAT ERROR]', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'ai',
          text: 'PulseMind is tuning... Starting music for you 🎧',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-5 z-50 flex flex-col items-end pointer-events-none font-sans">
      {/* Floating Toggle Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-500 text-white font-medium text-sm shadow-xl hover:scale-105 transition-all duration-200 border border-white/20 active:scale-95"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <span>PulseMind AI</span>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">🎧</span>
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="pointer-events-auto mt-3 w-80 sm:w-96 h-[460px] max-h-[75vh] flex flex-col rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-violet-500/30 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-violet-950/80 to-slate-900/80 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                ⚡
              </div>
              <div>
                <h3 className="text-white text-xs font-semibold tracking-wide">PulseMind AI Agent</h3>
                <p className="text-[10px] text-violet-300">Personal Music Intelligence</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 text-xs transition"
            >
              ✕
            </button>
          </div>

          {/* Current Song Context Badge */}
          {currentSong && (
            <div className="px-3 py-1.5 bg-violet-900/30 border-b border-violet-500/20 flex items-center justify-between text-[11px] text-violet-200">
              <span className="truncate max-w-[220px]">
                🎵 <strong className="text-white">{currentSong.title}</strong> — {currentSong.artist}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                {audioState === 'playing' ? 'Playing' : 'Paused'}
              </span>
            </div>
          )}

          {/* Quick Actions Carousel */}
          <div className="p-2 overflow-x-auto flex gap-1.5 bg-slate-900/40 border-b border-white/5 no-scrollbar scrollbar-none">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(action.text)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 text-[11px] rounded-full bg-white/5 hover:bg-violet-600/30 border border-white/10 hover:border-violet-400/40 text-violet-200 hover:text-white transition active:scale-95 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-violet-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-800/90 text-gray-100 border border-white/10 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}

                  {msg.reasons && msg.reasons.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-violet-300">
                      💡 {msg.reasons[0]}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 px-1">{msg.time}</span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-violet-400 text-xs p-2">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-100">●</span>
                <span className="animate-bounce delay-200">●</span>
                <span className="text-[11px] text-gray-400 ml-1">PulseMind thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Text Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2 bg-slate-900/90 border-t border-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tell PulseMind how you feel..."
              disabled={isLoading}
              className="flex-1 bg-slate-950 text-white text-xs px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-violet-500 placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium disabled:opacity-50 transition active:scale-95"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
