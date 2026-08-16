/**
 * Premium Voice Service Abstraction for PARO
 * Handles Text-to-Speech (TTS) with automatic selection of natural female system voices.
 */

class VoiceService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.selectedVoice = null;
    this.voicesLoaded = false;
    this.rate = 0.93;  // Slower, warm conversational speed (0.90x - 0.96x)
    this.pitch = 1.05; // Natural female pitch (no artificial shifting)
    this.volume = 0.90;

    if (this.synth) {
      this.initVoices();
    }
  }

  initVoices() {
    if (!this.synth) return;

    const load = () => {
      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        this.voicesLoaded = true;
        this.selectedVoice = this.selectParoVoice(voices);
      }
    };

    load();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  selectParoVoice(voices = []) {
    if (!voices || voices.length === 0) return null;

    // Preferred natural female voices across OS platforms (Windows, macOS, iOS, Android, Chrome)
    const femaleKeywords = [
      'google uk english female',
      'google us english',
      'microsoft ava neural',
      'microsoft emma neural',
      'microsoft aria neural',
      'microsoft zira',
      'samantha',
      'victoria',
      'karen',
      'fiona',
      'veena',
      'female',
      'woman',
    ];

    for (const kw of femaleKeywords) {
      const found = voices.find((v) => v.name.toLowerCase().includes(kw));
      if (found) {
        console.log(`[PARO VOICE SERVICE] Selected natural female voice: "${found.name}" (${found.lang})`);
        return found;
      }
    }

    // Fallback to any English voice
    const englishVoice = voices.find((v) => v.lang.startsWith('en'));
    const chosen = englishVoice || voices[0];
    console.log(`[PARO VOICE SERVICE] Fallback voice selected: "${chosen.name}"`);
    return chosen;
  }

  speak(text, onStart = null, onEnd = null) {
    if (!this.synth || !text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      if (!this.selectedVoice && this.synth.getVoices().length > 0) {
        this.selectedVoice = this.selectParoVoice(this.synth.getVoices());
      }

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onstart = () => {
        if (onStart) onStart();
      };

      utterance.onend = () => {
        if (onEnd) onEnd();
      };

      utterance.onerror = (err) => {
        console.warn('[PARO VOICE SYNTH ERROR]', err);
        if (onEnd) onEnd();
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('[PARO VOICE SPEAK EXCEPTION]', err.message);
      if (onEnd) onEnd();
    }
  }

  stopSpeaking() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (err) {}
    }
  }

  previewParoVoice(sampleText) {
    const sample = sampleText || "Hi, I'm PARO. What would you like to listen to?";
    this.speak(sample);
  }
}

export const voiceService = new VoiceService();
export default voiceService;
